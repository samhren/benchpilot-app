export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import {
  exercises as exercisesTable,
  lifts as liftsTable,
  sessionExercises,
  tmHistory,
  workoutSessions,
  workoutSets,
} from "@/lib/db/schema";
import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import LiftsClient, {
  type ExerciseEntry,
  type ExerciseHistory,
  type LiftSummary,
} from "./lifts-client";

const SHOWN_LIFTS = ["bench_press", "back_squat"] as const;
type ShownLiftName = (typeof SHOWN_LIFTS)[number];

const REP_PR_THRESHOLDS = [1, 3, 5, 8, 10] as const;

async function buildExerciseHistory(exerciseId: string): Promise<ExerciseHistory | null> {
  const [ex] = await db
    .select()
    .from(exercisesTable)
    .where(eq(exercisesTable.id, exerciseId))
    .limit(1);
  if (!ex) return null;

  const setRows = await db
    .select({
      weightUsed: workoutSets.weightUsed,
      repsCompleted: workoutSets.repsCompleted,
      isWarmup: workoutSets.isWarmup,
      isAmrap: workoutSets.isAmrap,
      completedAt: workoutSets.completedAt,
      sessionId: workoutSets.sessionId,
    })
    .from(workoutSets)
    .innerJoin(workoutSessions, eq(workoutSets.sessionId, workoutSessions.id))
    .where(
      and(
        eq(workoutSets.exerciseId, exerciseId),
        isNotNull(workoutSessions.completedAt),
        isNotNull(workoutSets.repsCompleted),
        isNotNull(workoutSets.weightUsed),
      ),
    )
    .orderBy(asc(workoutSets.completedAt));

  const sessionTop = new Map<string, { date: Date; weight: number; reps: number }>();
  const repPrs: Record<number, { weight: number; reps: number; completedAt: string } | null> = {};
  for (const n of REP_PR_THRESHOLDS) repPrs[n] = null;

  let totalSets = 0;
  let lastTrainedAt: string | null = null;

  for (const s of setRows) {
    if (s.isWarmup) continue;
    const w = s.weightUsed ?? 0;
    const r = s.repsCompleted ?? 0;
    if (w <= 0 || r <= 0) continue;
    totalSets += 1;
    const completed = s.completedAt as Date;
    lastTrainedAt = completed.toISOString();

    const key = s.sessionId;
    const cur = sessionTop.get(key);
    if (!cur || w > cur.weight) {
      sessionTop.set(key, { date: completed, weight: w, reps: r });
    }

    for (const n of REP_PR_THRESHOLDS) {
      if (r >= n) {
        const existing = repPrs[n];
        if (!existing || w > existing.weight) {
          repPrs[n] = { weight: w, reps: r, completedAt: completed.toISOString() };
        }
      }
    }
  }

  const topSetSeries = Array.from(sessionTop.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((b) => ({
      date: b.date.toISOString(),
      weight: b.weight,
      reps: b.reps,
    }));

  return {
    id: ex.id,
    name: ex.name,
    muscleGroup: ex.muscleGroup,
    equipment: ex.equipment,
    totalSets,
    lastTrainedAt,
    topSetSeries,
    repPrs: REP_PR_THRESHOLDS.map((n) => ({ reps: n, pr: repPrs[n] })),
  };
}

export default async function LiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ l?: string; ex?: string }>;
}) {
  const { l, ex } = await searchParams;
  const initial = (l as string | undefined) ?? "bench_press";

  const rows = await db
    .select()
    .from(liftsTable)
    .where(inArray(liftsTable.name, SHOWN_LIFTS as readonly ShownLiftName[]));

  const summaries: LiftSummary[] = [];
  for (const lift of rows) {
    const history = await db
      .select()
      .from(tmHistory)
      .where(eq(tmHistory.liftId, lift.id))
      .orderBy(desc(tmHistory.effectiveFrom));

    const workingSets = await db
      .select({
        weightUsed: workoutSets.weightUsed,
        repsCompleted: workoutSets.repsCompleted,
        isWarmup: workoutSets.isWarmup,
        isAmrap: workoutSets.isAmrap,
        completedAt: workoutSets.completedAt,
        sessionId: workoutSets.sessionId,
      })
      .from(workoutSets)
      .innerJoin(sessionExercises, eq(workoutSets.sessionExerciseId, sessionExercises.id))
      .innerJoin(workoutSessions, eq(workoutSets.sessionId, workoutSessions.id))
      .where(
        and(
          eq(sessionExercises.liftId, lift.id),
          isNotNull(workoutSessions.completedAt),
          isNotNull(workoutSets.repsCompleted),
          isNotNull(workoutSets.weightUsed),
        ),
      )
      .orderBy(desc(workoutSets.completedAt));

    let best: LiftSummary["bestSet"] = null;
    let lastTrainedAt: string | null = null;
    const sessionBuckets = new Map<string, { date: Date; volume: number; topWeight: number }>();

    for (const s of workingSets) {
      if (s.isWarmup) continue;
      const w = s.weightUsed ?? 0;
      const r = s.repsCompleted ?? 0;
      if (w <= 0 || r <= 0) continue;
      const completed = s.completedAt as Date;
      if (!lastTrainedAt) lastTrainedAt = completed.toISOString();

      const effReps = Math.min(r, 12);
      const e1rm = w * (1 + effReps / 30);
      if (!best || e1rm > best.e1RM) {
        best = {
          weight: w,
          reps: r,
          e1RM: Math.round(e1rm),
          completedAt: completed.toISOString(),
          isAmrap: s.isAmrap,
        };
      }

      const dayKey = completed.toISOString().slice(0, 10);
      const bucket = sessionBuckets.get(dayKey) ?? { date: completed, volume: 0, topWeight: 0 };
      bucket.volume += w * r;
      if (w > bucket.topWeight) bucket.topWeight = w;
      sessionBuckets.set(dayKey, bucket);
    }

    const volumeSeries = Array.from(sessionBuckets.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-12)
      .map((b) => ({
        date: b.date.toISOString(),
        volume: Math.round(b.volume),
        topWeight: b.topWeight,
      }));

    summaries.push({
      name: lift.name,
      currentOneRm: lift.currentOneRm,
      trainingMax: lift.trainingMax,
      bestSet: best,
      lastTrainedAt,
      volumeSeries,
      history: history.map((h) => ({
        trainingMax: h.trainingMax,
        effectiveFrom: (h.effectiveFrom as Date).toISOString(),
        reason: h.reason,
        amrapReps: h.amrapReps,
        notes: h.notes,
      })),
    });
  }

  summaries.sort(
    (a, b) =>
      SHOWN_LIFTS.indexOf(a.name as (typeof SHOWN_LIFTS)[number]) -
      SHOWN_LIFTS.indexOf(b.name as (typeof SHOWN_LIFTS)[number]),
  );

  const allExercises = await db
    .select({
      id: exercisesTable.id,
      name: exercisesTable.name,
      muscleGroup: exercisesTable.muscleGroup,
    })
    .from(exercisesTable)
    .orderBy(asc(exercisesTable.muscleGroup), asc(exercisesTable.name));

  const exerciseEntries: ExerciseEntry[] = allExercises;

  const selectedExercise = ex ? await buildExerciseHistory(ex) : null;

  return (
    <LiftsClient
      initial={initial}
      lifts={summaries}
      exerciseEntries={exerciseEntries}
      selectedExercise={selectedExercise}
      selectedExerciseId={ex ?? null}
    />
  );
}
