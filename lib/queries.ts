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
import { and, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { isoDate, scheduledDateForDay } from "@/lib/program-state";

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

export async function getAllExercises() {
  return db.select().from(exercises).orderBy(exercises.muscleGroup, exercises.name);
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

export async function getSessionExercises(sessionId: string) {
  return db
    .select({
      se: sessionExercises,
      ex: exercises,
    })
    .from(sessionExercises)
    .innerJoin(exercises, eq(sessionExercises.exerciseId, exercises.id))
    .where(eq(sessionExercises.sessionId, sessionId))
    .orderBy(sessionExercises.orderIndex);
}

export async function getInProgressSession() {
  const rows = await db
    .select({ s: workoutSessions, pd: programDays })
    .from(workoutSessions)
    .leftJoin(programDays, eq(workoutSessions.programDayId, programDays.id))
    .where(isNull(workoutSessions.completedAt))
    .orderBy(desc(workoutSessions.startedAt))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const [setCountRow] = await db
    .select({ c: sql<number>`count(*)` })
    .from(workoutSets)
    .where(eq(workoutSets.sessionId, row.s.id));
  return {
    sessionId: row.s.id,
    isExtra: row.s.isExtra,
    programDayId: row.s.programDayId,
    label: row.pd?.displayName ?? "Extra session",
    startedAt: (row.s.startedAt as Date).toISOString(),
    setsLogged: Number(setCountRow?.c ?? 0),
  };
}

export async function getLastCompletedSessionAt(): Promise<Date | null> {
  const [row] = await db
    .select()
    .from(workoutSessions)
    .where(isNotNull(workoutSessions.completedAt))
    .orderBy(desc(workoutSessions.completedAt))
    .limit(1);
  return row?.completedAt ? new Date(row.completedAt as unknown as string) : null;
}

// Days the user missed: scheduled date < today, no completed session,
// and not marked done/skipped/rescheduled-to-future via dayStatus.
export async function getMissedDays(programId: string, today = new Date(), tz?: string) {
  const program = await db.select().from(programs).where(eq(programs.id, programId)).limit(1);
  const p = program[0];
  if (!p) return [];

  const rows = await db
    .select({
      pd: programDays,
      sess: workoutSessions,
      ds: dayStatus,
    })
    .from(programDays)
    .leftJoin(
      workoutSessions,
      and(
        eq(workoutSessions.programDayId, programDays.id),
        isNotNull(workoutSessions.completedAt),
      ),
    )
    .leftJoin(dayStatus, eq(dayStatus.programDayId, programDays.id))
    .where(eq(programDays.programId, programId))
    .orderBy(programDays.weekNumber, programDays.dayOfWeek);

  const todayIso = isoDate(today, tz);
  const out: Array<{ pd: typeof programDays.$inferSelect; scheduledDate: string }> = [];
  for (const r of rows) {
    if (r.pd.sessionType === "rest") continue;
    if (r.sess) continue;
    const sIso = scheduledDateForDay(p.startDate, r.pd.weekNumber, r.pd.dayOfWeek);
    if (sIso >= todayIso) continue;
    if (r.ds) {
      // Treat skipped, done, or rescheduled-to-future as not-missed
      if (r.ds.state === "skipped" || r.ds.state === "done") continue;
      if (r.ds.state === "rescheduled" && r.ds.rescheduledTo && r.ds.rescheduledTo >= todayIso) continue;
    }
    out.push({ pd: r.pd, scheduledDate: sIso });
  }
  return out;
}

export async function getRescheduledDaysForToday(programId: string, today = new Date(), tz?: string) {
  const todayIso = isoDate(today, tz);
  const rows = await db
    .select({ pd: programDays, ds: dayStatus })
    .from(dayStatus)
    .innerJoin(programDays, eq(dayStatus.programDayId, programDays.id))
    .where(
      and(
        eq(programDays.programId, programId),
        eq(dayStatus.state, "rescheduled"),
        eq(dayStatus.rescheduledTo, todayIso),
      ),
    );
  return rows.map((r) => r.pd);
}

export async function getDayStatus(programDayId: string) {
  const [r] = await db
    .select()
    .from(dayStatus)
    .where(eq(dayStatus.programDayId, programDayId))
    .limit(1);
  return r ?? null;
}

export async function getBodyWeightsSinceDays(days: number, tz?: string) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const dateStr = isoDate(since, tz);
  return db
    .select()
    .from(bodyWeightLogs)
    .where(gte(bodyWeightLogs.date, dateStr))
    .orderBy(bodyWeightLogs.date);
}
