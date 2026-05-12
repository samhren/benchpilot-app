export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import {
  lifts as liftsTable,
  sessionExercises,
  tmHistory,
  workoutSessions,
  workoutSets,
} from "@/lib/db/schema";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import LiftsClient, { type LiftSummary } from "./lifts-client";

const SHOWN_LIFTS = ["bench_press", "back_squat"] as const;
type ShownLiftName = (typeof SHOWN_LIFTS)[number];

export default async function LiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ l?: string }>;
}) {
  const { l } = await searchParams;
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

    // All working sets for this lift across completed sessions.
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

  // Stable order: bench, squat
  summaries.sort(
    (a, b) =>
      SHOWN_LIFTS.indexOf(a.name as (typeof SHOWN_LIFTS)[number]) -
      SHOWN_LIFTS.indexOf(b.name as (typeof SHOWN_LIFTS)[number]),
  );

  return <LiftsClient initial={initial} lifts={summaries} />;
}
