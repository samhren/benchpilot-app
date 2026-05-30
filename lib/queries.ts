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
import { and, desc, eq, gte, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { computeProgramWeek, dayOfWeekInTz, isoDate, scheduledDateForDay } from "@/lib/program-state";
import { requireUserId } from "@/lib/auth";

// Every query here is scoped to the signed-in user. `requireUserId` reads the
// session cookie; middleware guarantees a valid session on every app route, so
// the throw path is effectively unreachable for normal navigation.

export async function getActiveProgram() {
  const userId = await requireUserId();
  const [p] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.userId, userId), eq(programs.status, "active")))
    .limit(1);
  return p ?? null;
}

export async function getSettings() {
  const userId = await requireUserId();
  const [s] = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
  return s ?? null;
}

export async function getAllLifts() {
  const userId = await requireUserId();
  return db.select().from(lifts).where(eq(lifts.userId, userId));
}

// The exercise library is shared across all users — not user-scoped.
export async function getAllExercises() {
  return db.select().from(exercises).orderBy(exercises.muscleGroup, exercises.name);
}

export async function getLiftByName(name: "bench_press" | "back_squat" | "deadlift" | "overhead_press") {
  const userId = await requireUserId();
  const [l] = await db
    .select()
    .from(lifts)
    .where(and(eq(lifts.userId, userId), eq(lifts.name, name)))
    .limit(1);
  return l ?? null;
}

export async function getProgramDay(id: string) {
  const userId = await requireUserId();
  const [pd] = await db
    .select()
    .from(programDays)
    .where(and(eq(programDays.id, id), eq(programDays.userId, userId)))
    .limit(1);
  return pd ?? null;
}

export async function getProgramDayByWeekDay(programId: string, weekNumber: number, dayOfWeek: number) {
  const userId = await requireUserId();
  const [pd] = await db
    .select()
    .from(programDays)
    .where(
      and(
        eq(programDays.userId, userId),
        eq(programDays.programId, programId),
        eq(programDays.weekNumber, weekNumber),
        eq(programDays.dayOfWeek, dayOfWeek),
      ),
    )
    .limit(1);
  return pd ?? null;
}

export async function getProgramExercises(programDayId: string) {
  const userId = await requireUserId();
  return db
    .select({
      pe: programExercises,
      ex: exercises,
    })
    .from(programExercises)
    .innerJoin(exercises, eq(programExercises.exerciseId, exercises.id))
    .where(
      and(eq(programExercises.programDayId, programDayId), eq(programExercises.userId, userId)),
    )
    .orderBy(programExercises.orderIndex);
}

export async function getAllProgramDays(programId: string) {
  const userId = await requireUserId();
  return db
    .select()
    .from(programDays)
    .where(and(eq(programDays.programId, programId), eq(programDays.userId, userId)))
    .orderBy(programDays.weekNumber, programDays.dayOfWeek);
}

export async function getRecentBodyWeights(limit = 30) {
  const userId = await requireUserId();
  return db
    .select()
    .from(bodyWeightLogs)
    .where(eq(bodyWeightLogs.userId, userId))
    .orderBy(desc(bodyWeightLogs.date))
    .limit(limit);
}

export async function getTmHistory(liftId: string) {
  const userId = await requireUserId();
  return db
    .select()
    .from(tmHistory)
    .where(and(eq(tmHistory.liftId, liftId), eq(tmHistory.userId, userId)))
    .orderBy(desc(tmHistory.effectiveFrom));
}

export async function getRecentSessions(limit = 30) {
  const userId = await requireUserId();
  return db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), isNotNull(workoutSessions.completedAt)))
    .orderBy(desc(workoutSessions.startedAt))
    .limit(limit);
}

export async function getLastSetForExercise(exerciseId: string) {
  const userId = await requireUserId();
  const [row] = await db
    .select()
    .from(workoutSets)
    .where(
      and(
        eq(workoutSets.userId, userId),
        eq(workoutSets.exerciseId, exerciseId),
        isNotNull(workoutSets.repsCompleted),
      ),
    )
    .orderBy(desc(workoutSets.completedAt))
    .limit(1);
  return row ?? null;
}

export type LastSessionSets = {
  sessionId: string;
  // ms since epoch — best available timestamp for "when this happened"
  date: number;
  sets: Array<{
    setNumber: number;
    reps: number;
    weight: number;
    rir: number | null;
    isAmrap: boolean;
  }>;
};

// Returns every logged set of `exerciseId` from the most recent prior session
// where it was performed. Excludes the in-progress session if supplied so the
// user sees actual prior data rather than what they just logged this session.
export async function getLastSessionSetsForExercise(
  exerciseId: string,
  excludeSessionId?: string,
): Promise<LastSessionSets | null> {
  const userId = await requireUserId();
  const conds = [
    eq(workoutSets.userId, userId),
    eq(workoutSets.exerciseId, exerciseId),
    isNotNull(workoutSets.repsCompleted),
  ];
  if (excludeSessionId) conds.push(ne(workoutSets.sessionId, excludeSessionId));

  const [mostRecent] = await db
    .select({ sessionId: workoutSets.sessionId })
    .from(workoutSets)
    .where(and(...conds))
    .orderBy(desc(workoutSets.completedAt))
    .limit(1);
  if (!mostRecent) return null;

  const sets = await db
    .select()
    .from(workoutSets)
    .where(
      and(
        eq(workoutSets.userId, userId),
        eq(workoutSets.sessionId, mostRecent.sessionId),
        eq(workoutSets.exerciseId, exerciseId),
        isNotNull(workoutSets.repsCompleted),
      ),
    )
    .orderBy(workoutSets.setNumber);
  if (sets.length === 0) return null;

  const [sess] = await db
    .select()
    .from(workoutSessions)
    .where(
      and(eq(workoutSessions.id, mostRecent.sessionId), eq(workoutSessions.userId, userId)),
    )
    .limit(1);
  const dateSource = sess?.completedAt ?? sess?.startedAt ?? sets[sets.length - 1].completedAt;
  return {
    sessionId: mostRecent.sessionId,
    date: new Date(dateSource as unknown as string | Date).getTime(),
    sets: sets.map((s) => ({
      setNumber: s.setNumber,
      reps: s.repsCompleted ?? 0,
      weight: s.weightUsed ?? 0,
      rir: s.rir,
      isAmrap: s.isAmrap,
    })),
  };
}

export async function getCompletedSessionForProgramDay(programDayId: string) {
  const userId = await requireUserId();
  const [s] = await db
    .select()
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.userId, userId),
        eq(workoutSessions.programDayId, programDayId),
        isNotNull(workoutSessions.completedAt),
      ),
    )
    .limit(1);
  return s ?? null;
}

export async function getNextScheduledDay(programId: string) {
  const candidate = await getScheduledDayCandidate(programId);
  return candidate?.pd ?? null;
}

export type ScheduledDayReason = "rescheduled_today" | "today" | "missed" | "upcoming";

export async function getScheduledDayCandidate(
  programId: string,
  today = new Date(),
  tz?: string,
): Promise<{
  pd: typeof programDays.$inferSelect;
  reason: ScheduledDayReason;
  scheduledDate: string;
  label: string;
} | null> {
  const userId = await requireUserId();
  const [program] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, programId), eq(programs.userId, userId)))
    .limit(1);
  if (!program) return null;

  const actualTz = tz ?? (await getSettings())?.timezone ?? "UTC";
  const todayIso = isoDate(today, actualTz);
  const currentWeek = computeProgramWeek(program.startDate, today, actualTz);
  const currentDay = dayOfWeekInTz(today, actualTz);

  const all = await db
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
        eq(workoutSessions.userId, userId),
        isNotNull(workoutSessions.completedAt),
      ),
    )
    .leftJoin(
      dayStatus,
      and(eq(dayStatus.programDayId, programDays.id), eq(dayStatus.userId, userId)),
    )
    .where(and(eq(programDays.programId, programId), eq(programDays.userId, userId)))
    .orderBy(programDays.weekNumber, programDays.dayOfWeek);

  const open = all
    .filter((r) => {
      if (r.pd.sessionType === "rest") return false;
      if (r.sess) return false;
      if (r.ds?.state === "done" || r.ds?.state === "skipped") return false;
      return true;
    })
    .map((r) => ({
      ...r,
      scheduledDate: scheduledDateForDay(program.startDate, r.pd.weekNumber, r.pd.dayOfWeek),
    }));

  const rescheduledToday = open.find(
    (r) => r.ds?.state === "rescheduled" && r.ds.rescheduledTo === todayIso,
  );
  if (rescheduledToday) {
    return {
      pd: rescheduledToday.pd,
      reason: "rescheduled_today",
      scheduledDate: todayIso,
      label: "Rescheduled today",
    };
  }

  const programmedToday = open.find(
    (r) => r.pd.weekNumber === currentWeek && r.pd.dayOfWeek === currentDay,
  );
  if (programmedToday) {
    return {
      pd: programmedToday.pd,
      reason: "today",
      scheduledDate: todayIso,
      label: "Today",
    };
  }

  const missed = open.find((r) => {
    if (r.scheduledDate >= todayIso) return false;
    if (r.ds?.state === "rescheduled" && r.ds.rescheduledTo && r.ds.rescheduledTo > todayIso) return false;
    return true;
  });
  if (missed) {
    return {
      pd: missed.pd,
      reason: "missed",
      scheduledDate: missed.scheduledDate,
      label: "Missed",
    };
  }

  const upcoming = open.find((r) => {
    if (r.ds?.state === "rescheduled") return !!r.ds.rescheduledTo && r.ds.rescheduledTo > todayIso;
    return r.scheduledDate > todayIso;
  });
  if (!upcoming) return null;
  return {
    pd: upcoming.pd,
    reason: "upcoming",
    scheduledDate: upcoming.ds?.rescheduledTo ?? upcoming.scheduledDate,
    label: "Upcoming",
  };
}

export async function getProgramOverview(programId: string) {
  const days = await getAllProgramDays(programId);
  // Aggregate by week
  return days;
}

export async function countCompletedSessions(programId: string): Promise<number> {
  const userId = await requireUserId();
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(workoutSessions)
    .innerJoin(programDays, eq(workoutSessions.programDayId, programDays.id))
    .where(
      and(
        eq(workoutSessions.userId, userId),
        eq(programDays.programId, programId),
        isNotNull(workoutSessions.completedAt),
      ),
    );
  return Number(rows[0]?.c ?? 0);
}

export async function getSessionExercises(sessionId: string) {
  const userId = await requireUserId();
  return db
    .select({
      se: sessionExercises,
      ex: exercises,
    })
    .from(sessionExercises)
    .innerJoin(exercises, eq(sessionExercises.exerciseId, exercises.id))
    .where(and(eq(sessionExercises.sessionId, sessionId), eq(sessionExercises.userId, userId)))
    .orderBy(sessionExercises.orderIndex);
}

// A 0-set session this old was started but never trained — the user opened a
// workout, logged nothing, and walked away. Nothing to resume.
const STALE_PHANTOM_MS = 3 * 60 * 60 * 1000;
// A session with sets logged but never completed, this far past any plausible
// workout length, has been abandoned mid-way.
const STALE_ABANDONED_MS = 12 * 60 * 60 * 1000;

export async function getInProgressSession() {
  const userId = await requireUserId();
  // Newest first. The status filter matters: abandoned/partial sessions can
  // also have completed_at IS NULL, and without it they'd leak into the
  // resume banner.
  const rows = await db
    .select({ s: workoutSessions, pd: programDays })
    .from(workoutSessions)
    .leftJoin(programDays, eq(workoutSessions.programDayId, programDays.id))
    .where(
      and(
        eq(workoutSessions.userId, userId),
        isNull(workoutSessions.completedAt),
        eq(workoutSessions.status, "in_progress"),
      ),
    )
    .orderBy(desc(workoutSessions.startedAt));

  const now = Date.now();
  for (const row of rows) {
    const [setCountRow] = await db
      .select({ c: sql<number>`count(*)` })
      .from(workoutSets)
      .where(eq(workoutSets.sessionId, row.s.id));
    const setsLogged = Number(setCountRow?.c ?? 0);
    const ageMs = now - (row.s.startedAt as Date).getTime();

    // Phantom: started, never trained, gone stale. Hard-delete it — there's
    // nothing to preserve, and opening the day again rebuilds an identical
    // snapshot. This is what kept the resume banner nagging for days after an
    // accidental "Start workout" tap.
    if (setsLogged === 0 && ageMs > STALE_PHANTOM_MS) {
      await db
        .delete(workoutSessions)
        .where(and(eq(workoutSessions.id, row.s.id), eq(workoutSessions.userId, userId)));
      continue;
    }
    // Real workout abandoned mid-way: keep the logged sets but stop nagging.
    if (setsLogged > 0 && ageMs > STALE_ABANDONED_MS) {
      await db
        .update(workoutSessions)
        .set({ status: "abandoned" })
        .where(and(eq(workoutSessions.id, row.s.id), eq(workoutSessions.userId, userId)));
      continue;
    }

    return {
      sessionId: row.s.id,
      isExtra: row.s.isExtra,
      programDayId: row.s.programDayId,
      label: row.pd?.displayName ?? "Extra session",
      startedAt: (row.s.startedAt as Date).toISOString(),
      setsLogged,
    };
  }
  return null;
}

export async function getLastCompletedSessionAt(): Promise<Date | null> {
  const userId = await requireUserId();
  const [row] = await db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), isNotNull(workoutSessions.completedAt)))
    .orderBy(desc(workoutSessions.completedAt))
    .limit(1);
  return row?.completedAt ? new Date(row.completedAt as unknown as string) : null;
}

// Days the user missed: scheduled date < today, no completed session,
// and not marked done/skipped/rescheduled-to-future via dayStatus.
export async function getMissedDays(programId: string, today = new Date(), tz?: string) {
  const userId = await requireUserId();
  const program = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, programId), eq(programs.userId, userId)))
    .limit(1);
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
        eq(workoutSessions.userId, userId),
        isNotNull(workoutSessions.completedAt),
      ),
    )
    .leftJoin(
      dayStatus,
      and(eq(dayStatus.programDayId, programDays.id), eq(dayStatus.userId, userId)),
    )
    .where(and(eq(programDays.programId, programId), eq(programDays.userId, userId)))
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
  const userId = await requireUserId();
  const todayIso = isoDate(today, tz);
  const rows = await db
    .select({ pd: programDays, ds: dayStatus })
    .from(dayStatus)
    .innerJoin(programDays, eq(dayStatus.programDayId, programDays.id))
    .where(
      and(
        eq(programDays.userId, userId),
        eq(programDays.programId, programId),
        eq(dayStatus.state, "rescheduled"),
        eq(dayStatus.rescheduledTo, todayIso),
      ),
    );
  return rows.map((r) => r.pd);
}

export async function getDayStatus(programDayId: string) {
  const userId = await requireUserId();
  const [r] = await db
    .select()
    .from(dayStatus)
    .where(and(eq(dayStatus.programDayId, programDayId), eq(dayStatus.userId, userId)))
    .limit(1);
  return r ?? null;
}

export async function getBodyWeightsSinceDays(days: number, tz?: string) {
  const userId = await requireUserId();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const dateStr = isoDate(since, tz);
  return db
    .select()
    .from(bodyWeightLogs)
    .where(and(eq(bodyWeightLogs.userId, userId), gte(bodyWeightLogs.date, dateStr)))
    .orderBy(bodyWeightLogs.date);
}
