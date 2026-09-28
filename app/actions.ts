"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  bodyWeightLogs,
  dayStatus,
  exercises,
  lifts,
  programDays,
  programExercises,
  programs,
  sessionExercises,
  settings,
  tmHistory,
  workoutSessions,
  workoutSets,
} from "@/lib/db/schema";
import { and, desc, eq, gt, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { resolveTrainingMax, resolveBenchPrescription } from "@/lib/programming/training-max";
import { applyAmrapBump } from "@/lib/programming/amrap";
import { isCleanSquatSession } from "@/lib/programming/squat-progression";
import { isoDate } from "@/lib/program-state";
import { requireUserId } from "@/lib/auth";

// Every mutation is scoped to the signed-in user: inserts carry their userId,
// and updates/deletes are constrained by it so a guessed row id from another
// account can never be read or written.

async function getTimezone(userId: string): Promise<string> {
  const [s] = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
  return s?.timezone ?? "UTC";
}

export async function logBodyWeightAction(weightLb: number) {
  const userId = await requireUserId();
  const v = z.number().positive().parse(weightLb);
  const tz = await getTimezone(userId);
  const today = isoDate(new Date(), tz);
  const [existing] = await db
    .select()
    .from(bodyWeightLogs)
    .where(and(eq(bodyWeightLogs.userId, userId), eq(bodyWeightLogs.date, today)))
    .limit(1);
  if (existing) {
    await db
      .update(bodyWeightLogs)
      .set({ weightLb: v })
      .where(and(eq(bodyWeightLogs.id, existing.id), eq(bodyWeightLogs.userId, userId)));
  } else {
    await db.insert(bodyWeightLogs).values({ userId, date: today, weightLb: v });
  }
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}

const SetOneRmSchema = z.object({
  liftName: z.enum(["bench_press", "back_squat", "deadlift", "overhead_press"]),
  oneRm: z.number().positive(),
});

export async function setLiftOneRmAction(input: z.infer<typeof SetOneRmSchema>) {
  const userId = await requireUserId();
  const { liftName, oneRm } = SetOneRmSchema.parse(input);
  const [lift] = await db
    .select()
    .from(lifts)
    .where(and(eq(lifts.userId, userId), eq(lifts.name, liftName)))
    .limit(1);
  if (!lift) return { ok: false as const, error: "Lift not found" };

  const tm = resolveTrainingMax(oneRm);
  await db
    .update(lifts)
    .set({ currentOneRm: oneRm, trainingMax: tm, updatedAt: new Date() })
    .where(and(eq(lifts.id, lift.id), eq(lifts.userId, userId)));

  await db.insert(tmHistory).values({
    userId,
    liftId: lift.id,
    trainingMax: tm,
    reason: "initial",
    notes: `Set 1RM = ${oneRm} lb → TM = ${tm} lb`,
  });

  revalidatePath("/", "layout");
  return { ok: true as const, tm };
}

const ManualTmSchema = z.object({
  liftName: z.enum(["bench_press", "back_squat", "deadlift", "overhead_press"]),
  trainingMax: z.number().positive(),
});

export async function manualSetTmAction(input: z.infer<typeof ManualTmSchema>) {
  const userId = await requireUserId();
  const { liftName, trainingMax } = ManualTmSchema.parse(input);
  const [lift] = await db
    .select()
    .from(lifts)
    .where(and(eq(lifts.userId, userId), eq(lifts.name, liftName)))
    .limit(1);
  if (!lift) return { ok: false as const };

  await db
    .update(lifts)
    .set({ trainingMax, lastTmBumpAt: new Date(), updatedAt: new Date() })
    .where(and(eq(lifts.id, lift.id), eq(lifts.userId, userId)));

  await db.insert(tmHistory).values({
    userId,
    liftId: lift.id,
    trainingMax,
    reason: "manual",
    notes: "Manual override",
  });

  revalidatePath("/", "layout");
  return { ok: true as const };
}

const StartSessionSchema = z.object({
  programDayId: z.string().uuid(),
  deloadFactor: z.number().min(0.3).max(1).optional(),
});

export async function startSessionAction(
  programDayIdOrInput: string | z.infer<typeof StartSessionSchema>,
) {
  const userId = await requireUserId();
  const input =
    typeof programDayIdOrInput === "string"
      ? { programDayId: programDayIdOrInput }
      : StartSessionSchema.parse(programDayIdOrInput);
  const { programDayId, deloadFactor } = input;

  // Guard: the program day must belong to this user.
  const [ownsDay] = await db
    .select({ id: programDays.id })
    .from(programDays)
    .where(and(eq(programDays.id, programDayId), eq(programDays.userId, userId)))
    .limit(1);
  if (!ownsDay) return { ok: false as const, error: "Program day not found" };

  // Find an existing in-flight session for this day, or start new: a live
  // one, or one auto-abandoned recently enough to still be the same workout
  // (see getInProgressSession). Older abandoned sessions stay abandoned.
  // If deloadFactor differs from the existing session, scrap the snapshot and rebuild it
  // (only safe when no sets have been logged yet).
  const [existing] = await db
    .select()
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.userId, userId),
        eq(workoutSessions.programDayId, programDayId),
        isNull(workoutSessions.completedAt),
        or(
          eq(workoutSessions.status, "in_progress"),
          and(
            eq(workoutSessions.status, "abandoned"),
            gt(workoutSessions.startedAt, sql`now() - interval '12 hours'`),
          ),
        ),
      ),
    )
    .orderBy(desc(workoutSessions.startedAt))
    .limit(1);
  if (existing) {
    // Reopening a day whose session went stale (see getInProgressSession)
    // picks the same session back up — its logged sets and the client's
    // localStorage buffer are both keyed by this session id.
    if (existing.status !== "in_progress") {
      await db
        .update(workoutSessions)
        .set({ status: "in_progress" })
        .where(and(eq(workoutSessions.id, existing.id), eq(workoutSessions.userId, userId)));
    }
    const wantsDifferentFactor =
      deloadFactor != null && Math.abs((existing.deloadFactor ?? 1) - deloadFactor) > 0.001;
    if (!wantsDifferentFactor) {
      return { ok: true as const, sessionId: existing.id };
    }
    const [hasSets] = await db
      .select()
      .from(workoutSets)
      .where(eq(workoutSets.sessionId, existing.id))
      .limit(1);
    if (hasSets) {
      return { ok: true as const, sessionId: existing.id };
    }
    // Rebuild: drop snapshot, update factor, recreate snapshot below.
    await db.delete(sessionExercises).where(eq(sessionExercises.sessionId, existing.id));
    await db
      .update(workoutSessions)
      .set({ deloadFactor: deloadFactor ?? 1 })
      .where(and(eq(workoutSessions.id, existing.id), eq(workoutSessions.userId, userId)));
    await rebuildSnapshot(userId, existing.id, programDayId, deloadFactor ?? 1);
    return { ok: true as const, sessionId: existing.id };
  }

  const [created] = await db
    .insert(workoutSessions)
    .values({
      userId,
      programDayId,
      status: "in_progress",
      deloadFactor: deloadFactor ?? 1,
    })
    .returning();

  await rebuildSnapshot(userId, created.id, programDayId, deloadFactor ?? 1);
  return { ok: true as const, sessionId: created.id };
}

// The most recent note the user wrote for each of `exerciseIds`, taken from
// their last session that included it. Lets exercise notes carry forward
// session-to-session until the user changes them. A returned value of `null`
// means the last occurrence had its note cleared — still carried. Exercises
// absent from the map have never been done before.
async function latestNotesByExercise(
  userId: string,
  exerciseIds: string[],
  excludeSessionId?: string,
): Promise<Map<string, string | null>> {
  if (exerciseIds.length === 0) return new Map();
  const conds = [
    eq(sessionExercises.userId, userId),
    inArray(sessionExercises.exerciseId, exerciseIds),
  ];
  if (excludeSessionId) conds.push(ne(sessionExercises.sessionId, excludeSessionId));
  const rows = await db
    .selectDistinctOn([sessionExercises.exerciseId], {
      exerciseId: sessionExercises.exerciseId,
      notes: sessionExercises.notes,
    })
    .from(sessionExercises)
    .innerJoin(workoutSessions, eq(sessionExercises.sessionId, workoutSessions.id))
    .where(and(...conds))
    .orderBy(sessionExercises.exerciseId, desc(workoutSessions.startedAt));
  return new Map(rows.map((r) => [r.exerciseId, r.notes]));
}

async function rebuildSnapshot(
  userId: string,
  sessionId: string,
  programDayId: string,
  factor: number,
) {
  const tmplRows = await db
    .select()
    .from(programExercises)
    .where(
      and(eq(programExercises.programDayId, programDayId), eq(programExercises.userId, userId)),
    )
    .orderBy(programExercises.orderIndex);

  const liftRows = await db.select().from(lifts).where(eq(lifts.userId, userId));
  const liftById = new Map(liftRows.map((l) => [l.id, l]));

  if (!tmplRows.length) return;

  // Carry each exercise's note forward from the user's last session.
  const noteMap = await latestNotesByExercise(
    userId,
    tmplRows.map((pe) => pe.exerciseId),
    sessionId,
  );

  await db.insert(sessionExercises).values(
    tmplRows.map((pe) => {
      let weightPrescribed: number | null = null;
      const lift = pe.liftId ? liftById.get(pe.liftId) : null;
      if (lift?.name === "back_squat" && lift.currentOneRm != null) {
        const pct = pe.percentageOfTm ?? 75;
        weightPrescribed = resolveBenchPrescription(pct * factor, lift.currentOneRm);
      } else if (pe.percentageOfTm != null && lift?.trainingMax != null) {
        weightPrescribed = resolveBenchPrescription(pe.percentageOfTm * factor, lift.trainingMax);
      }
      let wavePlan: unknown = pe.wavePlan;
      if (Array.isArray(pe.wavePlan) && factor !== 1) {
        wavePlan = (pe.wavePlan as Array<{ percentage: number; sets: number; reps: number; isAmrap?: boolean }>).map(
          (w) => ({ ...w, percentage: w.percentage * factor }),
        );
      }
      return {
        userId,
        sessionId,
        programExerciseId: pe.id,
        exerciseId: pe.exerciseId,
        orderIndex: pe.orderIndex,
        prescriptionType: pe.prescriptionType,
        sets: pe.sets,
        reps: pe.reps,
        percentageOfTm: pe.percentageOfTm != null ? pe.percentageOfTm * factor : null,
        weightPrescribed,
        rirTarget: pe.rirTarget,
        liftId: pe.liftId,
        wavePlan: wavePlan as never,
        isAmrapTopSet: pe.isAmrapTopSet,
        // The user's carried-forward note, or the program default if the
        // exercise has never been done before.
        notes: noteMap.has(pe.exerciseId) ? noteMap.get(pe.exerciseId)! : pe.notes,
      };
    }),
  );
}

const LogSetSchema = z.object({
  sessionId: z.string().uuid(),
  sessionExerciseId: z.string().uuid().optional(),
  programExerciseId: z.string().uuid().optional(),
  exerciseId: z.string().uuid(),
  setNumber: z.number().int().positive(),
  repsPrescribed: z.number().int().nullable(),
  repsCompleted: z.number().int().min(0),
  weightPrescribed: z.number().nullable(),
  weightUsed: z.number(),
  rir: z.number().int().min(0).max(10).nullable(),
  isAmrap: z.boolean(),
  isWarmup: z.boolean().default(false),
});

// Confirms the session belongs to this user. Returns true when ownership holds.
async function ownsSession(userId: string, sessionId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: workoutSessions.id })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, userId)))
    .limit(1);
  return !!row;
}

const SaveSessionSetsSchema = z.object({
  sessionId: z.string().uuid(),
  sets: z.array(LogSetSchema.omit({ sessionId: true })),
});

// Write sets to the server, keyed by (session exercise, set number): a set that
// already exists is replaced, every other logged set is left alone. Used both
// per set, the moment it is logged, and once more at submit to flush anything
// that didn't sync (e.g. logged offline).
//
// Merge — never "delete the session's sets, insert the buffer" — because the
// client buffer lives in localStorage, which a home-screen PWA can lose
// mid-workout (see CLAUDE.md). A replace-all save from an emptied buffer would
// wipe sets the server already holds.
async function upsertSessionSets(
  userId: string,
  sessionId: string,
  sets: Array<z.infer<typeof LogSetSchema>>,
) {
  if (sets.length === 0) return;
  await db.transaction(async (tx) => {
    for (const s of sets) {
      await tx
        .delete(workoutSets)
        .where(
          and(
            eq(workoutSets.userId, userId),
            eq(workoutSets.sessionId, sessionId),
            s.sessionExerciseId
              ? eq(workoutSets.sessionExerciseId, s.sessionExerciseId)
              : isNull(workoutSets.sessionExerciseId),
            eq(workoutSets.exerciseId, s.exerciseId),
            eq(workoutSets.setNumber, s.setNumber),
          ),
        );
    }
    await tx.insert(workoutSets).values(sets.map((s) => ({ ...s, sessionId, userId })));
  });
}

export async function logSetAction(input: z.infer<typeof LogSetSchema>) {
  const userId = await requireUserId();
  const data = LogSetSchema.parse(input);
  if (!(await ownsSession(userId, data.sessionId))) {
    return { ok: false as const, error: "Session not found" };
  }
  await upsertSessionSets(userId, data.sessionId, [data]);
  // First logged set anchors the workout clock. Idempotent.
  await db
    .update(workoutSessions)
    .set({ firstSetAt: new Date() })
    .where(
      and(
        eq(workoutSessions.id, data.sessionId),
        eq(workoutSessions.userId, userId),
        isNull(workoutSessions.firstSetAt),
      ),
    );
  return { ok: true as const };
}

export async function saveSessionSetsAction(
  input: z.infer<typeof SaveSessionSetsSchema>,
) {
  const userId = await requireUserId();
  const { sessionId, sets } = SaveSessionSetsSchema.parse(input);
  if (!(await ownsSession(userId, sessionId))) {
    return { ok: false as const, error: "Session not found" };
  }
  await upsertSessionSets(
    userId,
    sessionId,
    sets.map((s) => ({ ...s, sessionId })),
  );
  const [row] = await db
    .select({ c: sql<number>`count(*)` })
    .from(workoutSets)
    .where(and(eq(workoutSets.sessionId, sessionId), eq(workoutSets.userId, userId)));
  return { ok: true as const, count: Number(row?.c ?? 0) };
}

export async function completeSessionAction(sessionId: string) {
  const userId = await requireUserId();
  // Mark any still-pending session_exercises as skipped, but only set status=completed on the session.
  await db
    .update(workoutSessions)
    .set({ completedAt: new Date(), status: "completed" })
    .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, userId)));
  await maybeApplySquatProgression(userId, sessionId);
  await db
    .update(sessionExercises)
    .set({ status: "skipped" })
    .where(
      and(
        eq(sessionExercises.sessionId, sessionId),
        eq(sessionExercises.userId, userId),
        eq(sessionExercises.status, "pending"),
      ),
    );
  // Layout-level revalidation so the resume banner re-fetches and clears.
  revalidatePath("/", "layout");
  return { ok: true as const };
}

async function maybeApplySquatProgression(userId: string, sessionId: string) {
  const [squat] = await db
    .select()
    .from(lifts)
    .where(and(eq(lifts.userId, userId), eq(lifts.name, "back_squat")))
    .limit(1);
  if (!squat || squat.currentOneRm == null) return;

  const note = `Squat linear +5 after clean Lower A · session ${sessionId}`;
  const [already] = await db
    .select({ id: tmHistory.id })
    .from(tmHistory)
    .where(and(eq(tmHistory.userId, userId), eq(tmHistory.liftId, squat.id), eq(tmHistory.notes, note)))
    .limit(1);
  if (already) return;

  const rows = await db
    .select({
      repsPrescribed: workoutSets.repsPrescribed,
      repsCompleted: workoutSets.repsCompleted,
      weightPrescribed: workoutSets.weightPrescribed,
      weightUsed: workoutSets.weightUsed,
    })
    .from(workoutSets)
    .innerJoin(sessionExercises, eq(workoutSets.sessionExerciseId, sessionExercises.id))
    .where(
      and(
        eq(workoutSets.userId, userId),
        eq(workoutSets.sessionId, sessionId),
        eq(sessionExercises.liftId, squat.id),
      ),
    );

  if (rows.length === 0) return;
  // Advance only when every working set met or beat its prescription, judged by
  // estimated 1RM — so a heavier load for fewer reps still earns the bump. See
  // lib/programming/squat-progression.ts.
  if (!isCleanSquatSession(rows)) return;

  const oldWorkingWeight = resolveBenchPrescription(75, squat.currentOneRm);
  const nextWorkingWeight = oldWorkingWeight + 5;
  const nextOneRm = Math.round((nextWorkingWeight / 0.75) * 10) / 10;
  const nextTm = resolveTrainingMax(nextOneRm);

  await db
    .update(lifts)
    .set({
      currentOneRm: nextOneRm,
      trainingMax: nextTm,
      lastTmBumpAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(lifts.id, squat.id), eq(lifts.userId, userId)));
  await db.insert(tmHistory).values({
    userId,
    liftId: squat.id,
    trainingMax: nextTm,
    reason: "manual",
    notes: note,
  });
}

export async function discardSessionAction(sessionId: string) {
  const userId = await requireUserId();
  // Hard delete — FK cascades drop workout_sets and session_exercises rows.
  await db
    .delete(workoutSessions)
    .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, userId)));
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function endSessionEarlyAction(sessionId: string) {
  const userId = await requireUserId();
  await db
    .update(workoutSessions)
    .set({ completedAt: new Date(), status: "partial" })
    .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, userId)));
  await db
    .update(sessionExercises)
    .set({ status: "skipped" })
    .where(
      and(
        eq(sessionExercises.sessionId, sessionId),
        eq(sessionExercises.userId, userId),
        eq(sessionExercises.status, "pending"),
      ),
    );
  revalidatePath("/", "layout");
  return { ok: true as const };
}

const SetSessionExerciseNotesSchema = z.object({
  sessionExerciseId: z.string().uuid(),
  notes: z.string().max(2000).nullable(),
});

export async function setSessionExerciseNotesAction(
  input: z.infer<typeof SetSessionExerciseNotesSchema>,
) {
  const userId = await requireUserId();
  const { sessionExerciseId, notes } = SetSessionExerciseNotesSchema.parse(input);
  const trimmed = notes?.trim();
  await db
    .update(sessionExercises)
    .set({ notes: trimmed && trimmed.length > 0 ? trimmed : null })
    .where(
      and(eq(sessionExercises.id, sessionExerciseId), eq(sessionExercises.userId, userId)),
    );
  return { ok: true as const };
}

const SwapSchema = z.object({
  sessionExerciseId: z.string().uuid(),
  newExerciseId: z.string().uuid(),
});

export async function swapSessionExerciseAction(input: z.infer<typeof SwapSchema>) {
  const userId = await requireUserId();
  const { sessionExerciseId, newExerciseId } = SwapSchema.parse(input);

  const [se] = await db
    .select()
    .from(sessionExercises)
    .where(
      and(eq(sessionExercises.id, sessionExerciseId), eq(sessionExercises.userId, userId)),
    )
    .limit(1);
  if (!se) return { ok: false as const, error: "Session exercise not found" };

  const [setLogged] = await db
    .select()
    .from(workoutSets)
    .where(eq(workoutSets.sessionExerciseId, sessionExerciseId))
    .limit(1);
  if (setLogged) return { ok: false as const, error: "Cannot swap — sets already logged" };

  const [newEx] = await db
    .select()
    .from(exercises)
    .where(eq(exercises.id, newExerciseId))
    .limit(1);
  if (!newEx) return { ok: false as const, error: "Exercise not found" };

  // If swapping a main lift (had a liftId), null it so AMRAP bump logic doesn't fire on the substitute.
  await db
    .update(sessionExercises)
    .set({
      exerciseId: newExerciseId,
      swappedFromExerciseId: se.swappedFromExerciseId ?? se.exerciseId,
      liftId: null,
    })
    .where(
      and(eq(sessionExercises.id, sessionExerciseId), eq(sessionExercises.userId, userId)),
    );

  revalidatePath("/");
  return { ok: true as const, wasMainLift: se.liftId != null };
}

const ReorderSchema = z.object({
  sessionId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()).min(1),
});

export async function reorderSessionExercisesAction(input: z.infer<typeof ReorderSchema>) {
  const userId = await requireUserId();
  const { sessionId, orderedIds } = ReorderSchema.parse(input);
  // Sequential updates (drizzle's transaction API varies by driver). For dev DB this is fine.
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(sessionExercises)
      .set({ orderIndex: i })
      .where(
        and(
          eq(sessionExercises.id, orderedIds[i]),
          eq(sessionExercises.sessionId, sessionId),
          eq(sessionExercises.userId, userId),
        ),
      );
  }
  revalidatePath("/");
  return { ok: true as const };
}

const ExtraSessionExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  sets: z.number().int().positive(),
  reps: z.number().int().positive(),
  rirTarget: z.number().int().min(0).max(5).nullable().optional(),
});

const StartExtraSchema = z.object({
  exercises: z.array(ExtraSessionExerciseSchema).min(1),
});

export async function startExtraSessionAction(input: z.infer<typeof StartExtraSchema>) {
  const userId = await requireUserId();
  const { exercises: exs } = StartExtraSchema.parse(input);

  const [created] = await db
    .insert(workoutSessions)
    .values({
      userId,
      programDayId: null,
      isExtra: true,
      status: "in_progress",
      deloadFactor: 1,
    })
    .returning();

  // Carry each exercise's note forward from the user's last session.
  const noteMap = await latestNotesByExercise(
    userId,
    exs.map((e) => e.exerciseId),
    created.id,
  );

  await db.insert(sessionExercises).values(
    exs.map((e, i) => ({
      userId,
      sessionId: created.id,
      programExerciseId: null,
      exerciseId: e.exerciseId,
      orderIndex: i,
      prescriptionType: "rir_target" as const,
      sets: e.sets,
      reps: e.reps,
      rirTarget: e.rirTarget ?? 1,
      isAmrapTopSet: false,
      notes: noteMap.get(e.exerciseId) ?? null,
    })),
  );

  return { ok: true as const, sessionId: created.id };
}

const MarkDayStatusSchema = z.object({
  programDayId: z.string().uuid(),
  state: z.enum(["done", "missed", "rescheduled", "skipped"]),
  rescheduledTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function markDayStatusAction(input: z.infer<typeof MarkDayStatusSchema>) {
  const userId = await requireUserId();
  const data = MarkDayStatusSchema.parse(input);

  // Guard: the program day must belong to this user.
  const [ownsDay] = await db
    .select({ id: programDays.id })
    .from(programDays)
    .where(and(eq(programDays.id, data.programDayId), eq(programDays.userId, userId)))
    .limit(1);
  if (!ownsDay) return { ok: false as const, error: "Program day not found" };

  const [existing] = await db
    .select()
    .from(dayStatus)
    .where(and(eq(dayStatus.programDayId, data.programDayId), eq(dayStatus.userId, userId)))
    .limit(1);
  if (existing) {
    await db
      .update(dayStatus)
      .set({
        state: data.state,
        rescheduledTo: data.rescheduledTo ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(dayStatus.id, existing.id), eq(dayStatus.userId, userId)));
  } else {
    await db.insert(dayStatus).values({
      userId,
      programDayId: data.programDayId,
      state: data.state,
      rescheduledTo: data.rescheduledTo ?? null,
    });
  }
  revalidatePath("/");
  return { ok: true as const };
}

const AmrapApplySchema = z.object({
  liftName: z.enum(["bench_press", "back_squat", "deadlift", "overhead_press"]),
  amrapReps: z.number().int().nonnegative(),
  amrapPercentage: z.number().min(50).max(100).optional(),
  sessionId: z.string().uuid().optional(),
});

export async function applyAmrapBumpAction(input: z.infer<typeof AmrapApplySchema>) {
  const userId = await requireUserId();
  const { liftName, amrapReps, amrapPercentage, sessionId } = AmrapApplySchema.parse(input);
  if (sessionId && !(await ownsSession(userId, sessionId))) {
    return { ok: false as const, error: "Session not found" };
  }
  const [lift] = await db
    .select()
    .from(lifts)
    .where(and(eq(lifts.userId, userId), eq(lifts.name, liftName)))
    .limit(1);
  if (!lift || lift.trainingMax == null) return { ok: false as const, error: "TM not set" };
  const [settingsRow] = await db
    .select()
    .from(settings)
    .where(eq(settings.userId, userId))
    .limit(1);
  const units: "lb" | "kg" = settingsRow?.units === "kg" ? "kg" : "lb";
  const note = sessionId ? `Bench AMRAP bump · session ${sessionId}` : null;
  if (note) {
    const [existing] = await db
      .select({ id: tmHistory.id })
      .from(tmHistory)
      .where(and(eq(tmHistory.userId, userId), eq(tmHistory.liftId, lift.id), eq(tmHistory.notes, note)))
      .limit(1);
    if (existing) return { ok: true as const, applied: false, idempotent: true };
  }
  const result = applyAmrapBump(lift.trainingMax, amrapReps, { units, amrapPercentage });
  if (result.bumpAmount === 0) {
    return { ok: true as const, applied: false, ...result };
  }
  await db
    .update(lifts)
    .set({ trainingMax: result.newTm, lastTmBumpAt: new Date(), updatedAt: new Date() })
    .where(and(eq(lifts.id, lift.id), eq(lifts.userId, userId)));
  await db.insert(tmHistory).values({
    userId,
    liftId: lift.id,
    trainingMax: result.newTm,
    reason: "amrap_bump",
    amrapReps,
    notes: note ?? result.reason,
  });
  revalidatePath("/", "layout");
  return { ok: true as const, applied: true, ...result };
}

export async function setUnitsAction(units: "lb" | "kg") {
  const userId = await requireUserId();
  const [s] = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
  if (s) {
    await db
      .update(settings)
      .set({ units, updatedAt: new Date() })
      .where(and(eq(settings.id, s.id), eq(settings.userId, userId)));
  } else {
    await db.insert(settings).values({ userId, units });
  }
  revalidatePath("/settings");
  return { ok: true as const };
}

export async function setTimezoneAction(timezone: string) {
  const userId = await requireUserId();
  // Validate against the runtime's IANA list to avoid storing junk.
  const valid = z
    .string()
    .min(1)
    .max(100)
    .refine(
      (v) => {
        try {
          new Intl.DateTimeFormat("en-US", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      },
      { message: "Invalid IANA timezone" },
    )
    .safeParse(timezone);
  if (!valid.success) return { ok: false as const, error: valid.error.message };
  const tz = valid.data;
  const [s] = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
  if (s) {
    await db
      .update(settings)
      .set({ timezone: tz, updatedAt: new Date() })
      .where(and(eq(settings.id, s.id), eq(settings.userId, userId)));
  } else {
    await db.insert(settings).values({ userId, timezone: tz });
  }
  revalidatePath("/", "layout");
  return { ok: true as const };
}

const RestTimersSchema = z.object({
  mainSec: z.number().int().min(60).max(600),
  accessorySec: z.number().int().min(60).max(600),
});

export async function setRestTimersAction(input: z.infer<typeof RestTimersSchema>) {
  const userId = await requireUserId();
  const { mainSec, accessorySec } = RestTimersSchema.parse(input);
  const [s] = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
  if (s) {
    await db
      .update(settings)
      .set({
        defaultRestMainSec: mainSec,
        defaultRestAccessorySec: accessorySec,
        updatedAt: new Date(),
      })
      .where(and(eq(settings.id, s.id), eq(settings.userId, userId)));
  } else {
    await db.insert(settings).values({
      userId,
      defaultRestMainSec: mainSec,
      defaultRestAccessorySec: accessorySec,
    });
  }
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function setEnableWarmupAction(enabled: boolean) {
  const userId = await requireUserId();
  const [s] = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
  if (s) {
    await db
      .update(settings)
      .set({ enableWarmup: enabled, updatedAt: new Date() })
      .where(and(eq(settings.id, s.id), eq(settings.userId, userId)));
  } else {
    await db.insert(settings).values({ userId, enableWarmup: enabled });
  }
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function setShowTempoAction(enabled: boolean) {
  const userId = await requireUserId();
  const value = z.boolean().parse(enabled);
  const [s] = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
  if (s) {
    await db
      .update(settings)
      .set({ showTempo: value, updatedAt: new Date() })
      .where(and(eq(settings.id, s.id), eq(settings.userId, userId)));
  } else {
    await db.insert(settings).values({ userId, showTempo: value });
  }
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true as const };
}

const ComparisonProfileSchema = z.object({
  age: z.number().int().min(13).max(100).nullable(),
  bodyWeightLb: z.number().positive().min(70).max(500).nullable(),
});

export async function setComparisonProfileAction(input: z.infer<typeof ComparisonProfileSchema>) {
  const userId = await requireUserId();
  const { age, bodyWeightLb } = ComparisonProfileSchema.parse(input);
  const [s] = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
  if (s) {
    await db
      .update(settings)
      .set({
        age,
        comparisonBodyWeightLb: bodyWeightLb,
        updatedAt: new Date(),
      })
      .where(and(eq(settings.id, s.id), eq(settings.userId, userId)));
  } else {
    await db.insert(settings).values({ userId, age, comparisonBodyWeightLb: bodyWeightLb });
  }
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function setProgramStartDateAction(startDate: string) {
  const userId = await requireUserId();
  const parsed = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(startDate);
  if (!parsed.success) return { ok: false as const, error: "Invalid date" };
  const [p] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.userId, userId), eq(programs.status, "active")))
    .limit(1);
  if (!p) return { ok: false as const, error: "Program not found" };
  await db
    .update(programs)
    .set({ startDate: parsed.data })
    .where(and(eq(programs.id, p.id), eq(programs.userId, userId)));
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function resetProgramAction() {
  const userId = await requireUserId();
  // Delete this user's sessions and sets, reset week to 1. Scoped to the user —
  // never touches another account's data.
  await db.delete(workoutSets).where(eq(workoutSets.userId, userId));
  await db.delete(workoutSessions).where(eq(workoutSessions.userId, userId));
  // Must be the ACTIVE program: a user who has restarted their plan also has
  // archived ('completed') program rows, and an unfiltered select could reset
  // one of those instead of the run they're actually on.
  const [p] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.userId, userId), eq(programs.status, "active")))
    .limit(1);
  if (p) {
    await db
      .update(programs)
      .set({
        currentWeek: 1,
        status: "active",
        startDate: isoDate(new Date(), await getTimezone(userId)),
      })
      .where(and(eq(programs.id, p.id), eq(programs.userId, userId)));
  }
  revalidatePath("/");
  revalidatePath("/program");
  return { ok: true as const };
}

// Diagnostic: count completed sessions for the current user
export async function _diag() {
  const userId = await requireUserId();
  const r = await db
    .select({ c: sql<number>`count(*)` })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), isNotNull(workoutSessions.completedAt)));
  return { count: Number(r[0]?.c ?? 0) };
}
