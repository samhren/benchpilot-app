import { db } from "@/lib/db";
import {
  bodyWeightLogs,
  exercises,
  lifts,
  programDays,
  programExercises,
  programs,
  settings,
  tmHistory,
  workoutSessions,
  workoutSets,
} from "@/lib/db/schema";
import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";

export async function getActiveProgram() {
  const [p] = await db.select().from(programs).where(eq(programs.status, "active")).limit(1);
  return p ?? null;
}

export async function getSettings() {
  const [s] = await db.select().from(settings).limit(1);
  return s ?? null;
}

export async function getAllLifts() {
  return db.select().from(lifts);
}

export async function getLiftByName(name: "bench_press" | "back_squat" | "deadlift" | "overhead_press") {
  const [l] = await db.select().from(lifts).where(eq(lifts.name, name)).limit(1);
  return l ?? null;
}

export async function getProgramDay(id: string) {
  const [pd] = await db.select().from(programDays).where(eq(programDays.id, id)).limit(1);
  return pd ?? null;
}

export async function getProgramDayByWeekDay(programId: string, weekNumber: number, dayOfWeek: number) {
  const [pd] = await db
    .select()
    .from(programDays)
    .where(
      and(
        eq(programDays.programId, programId),
        eq(programDays.weekNumber, weekNumber),
        eq(programDays.dayOfWeek, dayOfWeek),
      ),
    )
    .limit(1);
  return pd ?? null;
}

export async function getProgramExercises(programDayId: string) {
  return db
    .select({
      pe: programExercises,
      ex: exercises,
    })
    .from(programExercises)
    .innerJoin(exercises, eq(programExercises.exerciseId, exercises.id))
    .where(eq(programExercises.programDayId, programDayId))
    .orderBy(programExercises.orderIndex);
}

export async function getAllProgramDays(programId: string) {
  return db
    .select()
    .from(programDays)
    .where(eq(programDays.programId, programId))
    .orderBy(programDays.weekNumber, programDays.dayOfWeek);
}

export async function getRecentBodyWeights(limit = 30) {
  return db
    .select()
    .from(bodyWeightLogs)
    .orderBy(desc(bodyWeightLogs.date))
    .limit(limit);
}

export async function getTmHistory(liftId: string) {
  return db
    .select()
    .from(tmHistory)
    .where(eq(tmHistory.liftId, liftId))
    .orderBy(desc(tmHistory.effectiveFrom));
}

export async function getRecentSessions(limit = 30) {
  return db
    .select()
    .from(workoutSessions)
    .where(isNotNull(workoutSessions.completedAt))
    .orderBy(desc(workoutSessions.startedAt))
    .limit(limit);
}

export async function getLastSetForExercise(exerciseId: string) {
  const [row] = await db
    .select()
    .from(workoutSets)
    .where(and(eq(workoutSets.exerciseId, exerciseId), isNotNull(workoutSets.repsCompleted)))
    .orderBy(desc(workoutSets.completedAt))
    .limit(1);
  return row ?? null;
}

export async function getCompletedSessionForProgramDay(programDayId: string) {
  const [s] = await db
    .select()
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.programDayId, programDayId),
        isNotNull(workoutSessions.completedAt),
      ),
    )
    .limit(1);
  return s ?? null;
}

export async function getNextScheduledDay(programId: string) {
  // First program day for this program with no completed session
  const all = await db
    .select({
      pd: programDays,
      sess: workoutSessions,
    })
    .from(programDays)
    .leftJoin(
      workoutSessions,
      and(
        eq(workoutSessions.programDayId, programDays.id),
        isNotNull(workoutSessions.completedAt),
      ),
    )
    .where(eq(programDays.programId, programId))
    .orderBy(programDays.weekNumber, programDays.dayOfWeek);

  const next = all.find((r) => r.sess == null && r.pd.sessionType !== "rest");
  return next?.pd ?? null;
}

export async function getProgramOverview(programId: string) {
  const days = await getAllProgramDays(programId);
  // Aggregate by week
  return days;
}

export async function countCompletedSessions(programId: string): Promise<number> {
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(workoutSessions)
    .innerJoin(programDays, eq(workoutSessions.programDayId, programDays.id))
    .where(and(eq(programDays.programId, programId), isNotNull(workoutSessions.completedAt)));
  return Number(rows[0]?.c ?? 0);
}

export async function getBodyWeightsSinceDays(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const dateStr = since.toISOString().slice(0, 10);
  return db
    .select()
    .from(bodyWeightLogs)
    .where(gte(bodyWeightLogs.date, dateStr))
    .orderBy(bodyWeightLogs.date);
}
