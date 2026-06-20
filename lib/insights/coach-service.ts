// Server-side orchestration for the AI coaching digest.
//
// The digest auto-generates — there is no button. To avoid spending an API call
// on every Insights view, regeneration is gated on NEW TRAINING: we only call
// the model when a workout has been completed since the last stored digest
// (or when forced). On the common path (no new workout) this is two cheap
// queries and zero API calls.

import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bodyWeightLogs,
  coachDigests,
  exercises,
  lifts,
  programs,
  sessionExercises,
  settings,
  tmHistory,
  workoutSessions,
  workoutSets,
} from "@/lib/db/schema";
import {
  computeStrength,
  computeVolumeByRegion,
  type InsightSet,
  type LiftName,
} from "@/lib/insights/muscle-model";
import {
  buildCoachContext,
  coachUserPrompt,
  COACH_RESPONSE_SCHEMA,
  COACH_SYSTEM_PROMPT,
  hashCoachContext,
  type CoachDigest,
  type TmInfo,
} from "@/lib/insights/coach";
import { generateJson, geminiModel, isGeminiConfigured } from "@/lib/ai/gemini";

export type CoachDigestView =
  | { status: "ok"; digest: CoachDigest; createdAt: string; stale: boolean }
  | { status: "empty" } // no completed workouts yet
  | { status: "unavailable" }; // generation failed and nothing cached

function viewFrom(row: typeof coachDigests.$inferSelect, stale: boolean): CoachDigestView {
  return {
    status: "ok",
    digest: { headline: row.headline, items: row.items as CoachDigest["items"] },
    createdAt: (row.createdAt as Date).toISOString(),
    stale,
  };
}

// Returns the current digest, regenerating only when there's new training since
// the last one. `force` bypasses the gate. Never calls revalidatePath, so it's
// safe to await directly inside a Server Component render.
export async function ensureCoachDigest(
  userId: string,
  opts: { force?: boolean } = {},
): Promise<CoachDigestView> {
  const [latest] = await db
    .select()
    .from(coachDigests)
    .where(eq(coachDigests.userId, userId))
    .orderBy(desc(coachDigests.createdAt))
    .limit(1);

  const [lastSession] = await db
    .select({ completedAt: workoutSessions.completedAt })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), isNotNull(workoutSessions.completedAt)))
    .orderBy(desc(workoutSessions.completedAt))
    .limit(1);

  const lastWorkoutMs = lastSession?.completedAt
    ? new Date(lastSession.completedAt as Date).getTime()
    : null;

  // No completed workouts at all → nothing to coach on.
  if (lastWorkoutMs == null) {
    return latest ? viewFrom(latest, false) : { status: "empty" };
  }

  const latestMs = latest ? new Date(latest.createdAt as Date).getTime() : 0;
  const needsRegen = Boolean(opts.force) || !latest || lastWorkoutMs > latestMs;
  if (!needsRegen) return viewFrom(latest!, false);

  // ---- Regenerate: gather the full data picture. ----
  const [settingsRow] = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
  const [latestBodyWeight] = await db
    .select()
    .from(bodyWeightLogs)
    .where(eq(bodyWeightLogs.userId, userId))
    .orderBy(desc(bodyWeightLogs.date))
    .limit(1);
  const liftRows = await db
    .select({ id: lifts.id, name: lifts.name, currentOneRm: lifts.currentOneRm, trainingMax: lifts.trainingMax })
    .from(lifts)
    .where(eq(lifts.userId, userId));
  const [program] = await db
    .select({ week: programs.currentWeek, block: programs.currentBlock, totalWeeks: programs.totalWeeks })
    .from(programs)
    .where(and(eq(programs.userId, userId), eq(programs.status, "active")))
    .limit(1);
  const tmRows = await db
    .select({ liftId: tmHistory.liftId, reason: tmHistory.reason, effectiveFrom: tmHistory.effectiveFrom })
    .from(tmHistory)
    .where(eq(tmHistory.userId, userId));

  const rows = await db
    .select({
      exerciseName: exercises.name,
      muscleGroup: exercises.muscleGroup,
      weight: workoutSets.weightUsed,
      reps: workoutSets.repsCompleted,
      rir: workoutSets.rir,
      isWarmup: workoutSets.isWarmup,
      isAmrap: workoutSets.isAmrap,
      weightPrescribed: workoutSets.weightPrescribed,
      repsPrescribed: workoutSets.repsPrescribed,
      percentageOfTm: sessionExercises.percentageOfTm,
      completedAt: workoutSets.completedAt,
    })
    .from(workoutSets)
    .innerJoin(workoutSessions, eq(workoutSets.sessionId, workoutSessions.id))
    .innerJoin(sessionExercises, eq(workoutSets.sessionExerciseId, sessionExercises.id))
    .innerJoin(exercises, eq(workoutSets.exerciseId, exercises.id))
    .where(
      and(
        eq(workoutSets.userId, userId),
        isNotNull(workoutSessions.completedAt),
        isNotNull(workoutSets.weightUsed),
        isNotNull(workoutSets.repsCompleted),
      ),
    );

  if (rows.length === 0) {
    return latest ? viewFrom(latest, false) : { status: "empty" };
  }

  const sets: InsightSet[] = rows.map((r) => ({
    exerciseName: r.exerciseName,
    muscleGroup: r.muscleGroup,
    weight: r.weight ?? 0,
    reps: r.reps ?? 0,
    rir: r.rir,
    isWarmup: r.isWarmup,
    isAmrap: r.isAmrap,
    weightPrescribed: r.weightPrescribed,
    repsPrescribed: r.repsPrescribed,
    percentageOfTm: r.percentageOfTm,
    completedAt: new Date(r.completedAt as Date).toISOString(),
  }));

  const bodyWeight = settingsRow?.comparisonBodyWeightLb ?? latestBodyWeight?.weightLb ?? null;
  const liftOneRms: Partial<Record<LiftName, number | null>> = {};
  for (const l of liftRows) liftOneRms[l.name as LiftName] = l.currentOneRm;

  const SIX_WEEKS_MS = 42 * 86_400_000;
  const sinceMs = Date.now() - SIX_WEEKS_MS;
  const tmInfo: TmInfo[] = liftRows.map((l) => ({
    liftName: l.name as LiftName,
    trainingMax: l.trainingMax,
    recentBumps: tmRows.filter(
      (t) =>
        t.liftId === l.id &&
        (t.reason === "amrap_bump" || t.reason === "manual") &&
        new Date(t.effectiveFrom as Date).getTime() >= sinceMs,
    ).length,
  }));

  const volume = computeVolumeByRegion(sets);
  const strength = computeStrength(sets, {
    lifts: liftOneRms,
    bodyWeightLb: bodyWeight,
    age: settingsRow?.age ?? null,
  });

  const ctx = buildCoachContext({
    sets,
    volume,
    strength,
    bodyWeightLb: bodyWeight,
    age: settingsRow?.age ?? null,
    program: program ? { week: program.week, block: program.block, totalWeeks: program.totalWeeks } : null,
    tmInfo,
  });
  const inputHash = hashCoachContext(ctx);

  // Belt-and-suspenders: if the data picture is byte-identical to the last
  // digest (e.g. a workout was completed but logged no new working sets), reuse it.
  if (!opts.force && latest && latest.inputHash === inputHash) {
    return viewFrom(latest, false);
  }

  if (!isGeminiConfigured()) {
    return latest ? viewFrom(latest, true) : { status: "unavailable" };
  }

  let digest: CoachDigest;
  try {
    digest = await generateJson<CoachDigest>({
      system: COACH_SYSTEM_PROMPT,
      prompt: coachUserPrompt(ctx),
      schema: COACH_RESPONSE_SCHEMA,
    });
  } catch {
    // Keep showing the last good digest rather than erroring the tab.
    return latest ? viewFrom(latest, true) : { status: "unavailable" };
  }

  const items = (Array.isArray(digest.items) ? digest.items : [])
    .slice(0, 4)
    .map((it) => ({
      priority: (["high", "medium", "low"] as const).includes(it.priority) ? it.priority : "medium",
      title: String(it.title ?? "").slice(0, 120),
      detail: String(it.detail ?? "").slice(0, 400),
      ...(it.tag ? { tag: String(it.tag).slice(0, 40) } : {}),
    }));
  const clean: CoachDigest = { headline: String(digest.headline ?? "").slice(0, 200), items };

  const [saved] = await db
    .insert(coachDigests)
    .values({ userId, model: geminiModel(), inputHash, headline: clean.headline, items: clean.items })
    .returning({ createdAt: coachDigests.createdAt });

  return { status: "ok", digest: clean, createdAt: (saved.createdAt as Date).toISOString(), stale: false };
}
