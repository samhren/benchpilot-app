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
import { getActiveProgram, getAllProgramDays, getSettings } from "@/lib/queries";
import { computeProgramWeek, isoDate, scheduledDateForDay } from "@/lib/program-state";
import { computeLiftStats, type LiftStats, type StatSet } from "@/lib/lift-stats";
import LiftsClient, {
  type ExerciseEntry,
  type ExerciseHistory,
  type LiftSummary,
  type ProgramContext,
} from "./lifts-client";

const SHOWN_LIFTS = ["bench_press", "back_squat"] as const;
type ShownLiftName = (typeof SHOWN_LIFTS)[number];

// Map a raw workout_sets row to the shape lift-stats expects.
function toStatSet(r: {
  weightUsed: number | null;
  repsCompleted: number | null;
  isWarmup: boolean;
  isAmrap: boolean;
  completedAt: Date | string;
  sessionId: string;
}): StatSet {
  return {
    weight: r.weightUsed ?? 0,
    reps: r.repsCompleted ?? 0,
    isWarmup: r.isWarmup,
    isAmrap: r.isAmrap,
    completedAt: new Date(r.completedAt).toISOString(),
    sessionId: r.sessionId,
  };
}

async function buildExerciseHistory(
  exerciseId: string,
  tz: string,
): Promise<ExerciseHistory | null> {
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
    );

  return {
    id: ex.id,
    name: ex.name,
    muscleGroup: ex.muscleGroup,
    equipment: ex.equipment,
    stats: computeLiftStats(setRows.map(toStatSet), tz),
  };
}

export default async function LiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ l?: string; ex?: string }>;
}) {
  const { l, ex } = await searchParams;
  const initial = (l as string | undefined) ?? "bench_press";

  const [settingsRow, program] = await Promise.all([getSettings(), getActiveProgram()]);
  const tz = settingsRow?.timezone ?? "UTC";
  const now = new Date();

  const liftRows = await db
    .select()
    .from(liftsTable)
    .where(inArray(liftsTable.name, SHOWN_LIFTS as readonly ShownLiftName[]));
  const liftIds = liftRows.map((l) => l.id);

  // Two batched queries replace the old per-lift N+1 loop.
  const [tmRows, setRows] = await Promise.all([
    liftIds.length
      ? db
          .select()
          .from(tmHistory)
          .where(inArray(tmHistory.liftId, liftIds))
          .orderBy(desc(tmHistory.effectiveFrom))
      : Promise.resolve([]),
    liftIds.length
      ? db
          .select({
            liftId: sessionExercises.liftId,
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
              inArray(sessionExercises.liftId, liftIds),
              isNotNull(workoutSessions.completedAt),
              isNotNull(workoutSets.repsCompleted),
              isNotNull(workoutSets.weightUsed),
            ),
          )
      : Promise.resolve([]),
  ]);

  const summaries: LiftSummary[] = liftRows
    .map((lift): LiftSummary => {
      const sets = setRows.filter((s) => s.liftId === lift.id).map(toStatSet);
      const stats: LiftStats = computeLiftStats(sets, tz, now);
      return {
        name: lift.name,
        currentOneRm: lift.currentOneRm,
        trainingMax: lift.trainingMax,
        stats,
        history: tmRows
          .filter((h) => h.liftId === lift.id)
          .map((h) => ({
            trainingMax: h.trainingMax,
            effectiveFrom: (h.effectiveFrom as Date).toISOString(),
            reason: h.reason,
            amrapReps: h.amrapReps,
            notes: h.notes,
          })),
      };
    })
    .sort(
      (a, b) =>
        SHOWN_LIFTS.indexOf(a.name as ShownLiftName) -
        SHOWN_LIFTS.indexOf(b.name as ShownLiftName),
    );

  // Program context: where you are, and how well you've kept up.
  let programCtx: ProgramContext | null = null;
  if (program) {
    const [programDays, completedRows] = await Promise.all([
      getAllProgramDays(program.id),
      db
        .select({ programDayId: workoutSessions.programDayId })
        .from(workoutSessions)
        .where(isNotNull(workoutSessions.completedAt)),
    ]);
    const completedDayIds = new Set(
      completedRows.map((r) => r.programDayId).filter((id): id is string => !!id),
    );
    const todayIso = isoDate(now, tz);
    let done = 0;
    let total = 0;
    for (const pd of programDays) {
      if (pd.sessionType === "rest") continue;
      const sIso = scheduledDateForDay(program.startDate, pd.weekNumber, pd.dayOfWeek);
      if (sIso > todayIso) continue;
      total += 1;
      if (completedDayIds.has(pd.id)) done += 1;
    }
    programCtx = {
      week: computeProgramWeek(program.startDate, now, tz),
      totalWeeks: program.totalWeeks,
      block: program.currentBlock,
      adherenceDone: done,
      adherenceTotal: total,
    };
  }

  const allExercises = await db
    .select({
      id: exercisesTable.id,
      name: exercisesTable.name,
      muscleGroup: exercisesTable.muscleGroup,
    })
    .from(exercisesTable)
    .orderBy(asc(exercisesTable.muscleGroup), asc(exercisesTable.name));
  const exerciseEntries: ExerciseEntry[] = allExercises;

  const selectedExercise = ex ? await buildExerciseHistory(ex, tz) : null;

  return (
    <LiftsClient
      initial={initial}
      lifts={summaries}
      program={programCtx}
      exerciseEntries={exerciseEntries}
      selectedExercise={selectedExercise}
      selectedExerciseId={ex ?? null}
    />
  );
}
