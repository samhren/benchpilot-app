export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { bodyWeightLogs, exercises, lifts, sessionExercises, settings, workoutSessions, workoutSets } from "@/lib/db/schema";
import { requireUserId } from "@/lib/auth";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import {
  computeStrength,
  computeVolumeByRegion,
  type InsightSet,
  type LiftName,
} from "@/lib/insights/muscle-model";
import InsightsClient from "./insights-client";

export default async function InsightsPage() {
  const userId = await requireUserId();
  const [settingsRow] = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
  const [latestBodyWeight] = await db
    .select()
    .from(bodyWeightLogs)
    .where(eq(bodyWeightLogs.userId, userId))
    .orderBy(desc(bodyWeightLogs.date))
    .limit(1);
  const liftRows = await db
    .select({ name: lifts.name, currentOneRm: lifts.currentOneRm })
    .from(lifts)
    .where(eq(lifts.userId, userId));

  const rows = await db
    .select({
      exerciseName: exercises.name,
      muscleGroup: exercises.muscleGroup,
      weight: workoutSets.weightUsed,
      reps: workoutSets.repsCompleted,
      rir: workoutSets.rir,
      isWarmup: workoutSets.isWarmup,
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

  const bodyWeight =
    settingsRow?.comparisonBodyWeightLb ?? latestBodyWeight?.weightLb ?? null;
  const sets: InsightSet[] = rows.map((r) => ({
    exerciseName: r.exerciseName,
    muscleGroup: r.muscleGroup,
    weight: r.weight ?? 0,
    reps: r.reps ?? 0,
    rir: r.rir,
    isWarmup: r.isWarmup,
    completedAt: new Date(r.completedAt as Date).toISOString(),
  }));

  const liftOneRms: Partial<Record<LiftName, number | null>> = {};
  for (const l of liftRows) liftOneRms[l.name as LiftName] = l.currentOneRm;

  const volume = computeVolumeByRegion(sets);
  const strength = computeStrength(sets, {
    lifts: liftOneRms,
    bodyWeightLb: bodyWeight,
    age: settingsRow?.age ?? null,
  });

  return (
    <InsightsClient
      volume={volume}
      strength={strength}
      bodyWeight={bodyWeight}
      age={settingsRow?.age ?? null}
    />
  );
}
