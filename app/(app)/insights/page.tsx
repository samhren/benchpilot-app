export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { bodyWeightLogs, exercises, sessionExercises, settings, workoutSessions, workoutSets } from "@/lib/db/schema";
import { requireUserId } from "@/lib/auth";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { computeMuscleInsights, type InsightSet } from "@/lib/insights/muscle-model";
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

  const insights = computeMuscleInsights(sets, {
    bodyWeightLb: bodyWeight,
    age: settingsRow?.age ?? null,
  });

  return (
    <InsightsClient
      insights={insights}
      bodyWeight={bodyWeight}
      age={settingsRow?.age ?? null}
    />
  );
}
