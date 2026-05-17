export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import {
  exercises as exercisesTable,
  lifts as liftsTable,
  programDays as programDaysTable,
  sessionExercises,
  workoutSessions,
  workoutSets,
} from "@/lib/db/schema";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getActiveProgram, getAllProgramDays, getSettings } from "@/lib/queries";
import { computeProgramWeek, isoDate, scheduledDateForDay } from "@/lib/program-state";
import { computeLiftStats, type LiftStats, type StatSet } from "@/lib/lift-stats";
import LiftsClient, {
  type ExerciseEntry,
  type ExerciseHistory,
  type LiftSummary,
  type ProgramContext,
  type SessionDetail,
  type SessionListItem,
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

// Every completed workout, newest first — the History tab list.
async function buildSessionList(): Promise<SessionListItem[]> {
  const rows = await db
    .select({
      id: workoutSessions.id,
      displayName: programDaysTable.displayName,
      sessionType: programDaysTable.sessionType,
      completedAt: workoutSessions.completedAt,
      isExtra: workoutSessions.isExtra,
      setCount: sql<number>`count(${workoutSets.id})`,
    })
    .from(workoutSessions)
    .leftJoin(programDaysTable, eq(workoutSessions.programDayId, programDaysTable.id))
    .leftJoin(workoutSets, eq(workoutSets.sessionId, workoutSessions.id))
    .where(isNotNull(workoutSessions.completedAt))
    .groupBy(workoutSessions.id, programDaysTable.id)
    .orderBy(desc(workoutSessions.completedAt))
    .limit(80);

  return rows.map((r) => ({
    id: r.id,
    name: r.displayName ?? (r.isExtra ? "Extra session" : "Workout"),
    sessionType: r.sessionType ?? null,
    completedAt: new Date(r.completedAt as Date).toISOString(),
    setCount: Number(r.setCount),
  }));
}

// One completed workout, broken out exercise-by-exercise with every set.
async function buildSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  const [header] = await db
    .select({
      id: workoutSessions.id,
      completedAt: workoutSessions.completedAt,
      notes: workoutSessions.notes,
      bodyWeightLb: workoutSessions.bodyWeightLb,
      isExtra: workoutSessions.isExtra,
      displayName: programDaysTable.displayName,
      sessionType: programDaysTable.sessionType,
    })
    .from(workoutSessions)
    .leftJoin(programDaysTable, eq(workoutSessions.programDayId, programDaysTable.id))
    .where(eq(workoutSessions.id, sessionId))
    .limit(1);
  if (!header || !header.completedAt) return null;

  const setRows = await db
    .select({
      exerciseId: workoutSets.exerciseId,
      exerciseName: exercisesTable.name,
      muscleGroup: exercisesTable.muscleGroup,
      orderIndex: sessionExercises.orderIndex,
      setNumber: workoutSets.setNumber,
      weightUsed: workoutSets.weightUsed,
      repsCompleted: workoutSets.repsCompleted,
      rir: workoutSets.rir,
      isAmrap: workoutSets.isAmrap,
      isWarmup: workoutSets.isWarmup,
    })
    .from(workoutSets)
    .innerJoin(exercisesTable, eq(workoutSets.exerciseId, exercisesTable.id))
    .leftJoin(sessionExercises, eq(workoutSets.sessionExerciseId, sessionExercises.id))
    .where(eq(workoutSets.sessionId, sessionId))
    .orderBy(asc(sessionExercises.orderIndex), asc(workoutSets.setNumber));

  const byExercise = new Map<string, SessionDetail["exercises"][number]>();
  const order: string[] = [];
  for (const r of setRows) {
    if (r.repsCompleted == null || r.weightUsed == null) continue;
    let group = byExercise.get(r.exerciseId);
    if (!group) {
      group = { name: r.exerciseName, muscleGroup: r.muscleGroup, sets: [] };
      byExercise.set(r.exerciseId, group);
      order.push(r.exerciseId);
    }
    group.sets.push({
      setNumber: r.setNumber,
      weight: r.weightUsed,
      reps: r.repsCompleted,
      rir: r.rir,
      isAmrap: r.isAmrap,
      isWarmup: r.isWarmup,
    });
  }

  return {
    id: header.id,
    name: header.displayName ?? (header.isExtra ? "Extra session" : "Workout"),
    sessionType: header.sessionType ?? null,
    completedAt: new Date(header.completedAt as Date).toISOString(),
    notes: header.notes,
    bodyWeightLb: header.bodyWeightLb,
    exercises: order.map((id) => byExercise.get(id)!),
  };
}

export default async function LiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ l?: string; ex?: string; session?: string }>;
}) {
  const { l, ex, session } = await searchParams;
  const initial = (l as string | undefined) ?? "bench_press";

  const [settingsRow, program] = await Promise.all([getSettings(), getActiveProgram()]);
  const tz = settingsRow?.timezone ?? "UTC";
  const now = new Date();

  const liftRows = await db
    .select()
    .from(liftsTable)
    .where(inArray(liftsTable.name, SHOWN_LIFTS as readonly ShownLiftName[]));
  const liftIds = liftRows.map((l) => l.id);

  // One batched query replaces the old per-lift N+1 loop. Training-max
  // history is intentionally not read here — TM lives in Settings.
  const setRows = liftIds.length
    ? await db
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
    : [];

  const summaries: LiftSummary[] = liftRows
    .map((lift): LiftSummary => {
      const sets = setRows.filter((s) => s.liftId === lift.id).map(toStatSet);
      const stats: LiftStats = computeLiftStats(sets, tz, now);
      return { name: lift.name, stats };
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

  const [selectedExercise, sessionList, selectedSession] = await Promise.all([
    ex ? buildExerciseHistory(ex, tz) : Promise.resolve(null),
    buildSessionList(),
    session ? buildSessionDetail(session) : Promise.resolve(null),
  ]);

  return (
    <LiftsClient
      initial={initial}
      lifts={summaries}
      program={programCtx}
      exerciseEntries={exerciseEntries}
      selectedExercise={selectedExercise}
      selectedExerciseId={ex ?? null}
      sessionList={sessionList}
      selectedSession={selectedSession}
      selectedSessionId={session ?? null}
    />
  );
}
