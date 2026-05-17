// Lift progress aggregation — pure, framework-agnostic transforms.
// DB rows come in, serializable stats go out. No Drizzle / no React here so
// every function below is unit-testable (see lift-stats.test.ts).
import { dayOfWeekInTz, isoDateInTz } from "@/lib/program-state";

export const REP_PR_THRESHOLDS = [1, 3, 5, 8, 10] as const;

// A single working/warmup set, already narrowed to the columns we need.
export interface StatSet {
  weight: number;
  reps: number;
  isWarmup: boolean;
  isAmrap: boolean;
  completedAt: string; // ISO timestamp
  sessionId: string;
}

export interface E1rmPoint {
  t: number; // ms since epoch — chart x value
  date: string; // ISO
  e1rm: number; // rounded
  weight: number;
  reps: number;
  isAmrap: boolean;
}

export interface WeekBucket {
  weekStart: string; // ISO date of the Monday
  t: number; // ms of weekStart — chart x value
  volume: number; // sum of weight * reps
  sets: number;
  sessions: number;
}

export interface RepPr {
  reps: number;
  pr: { weight: number; reps: number; completedAt: string } | null;
}

export interface BestSet {
  weight: number;
  reps: number;
  e1rm: number;
  completedAt: string;
  isAmrap: boolean;
}

export interface LiftStats {
  e1rmSeries: E1rmPoint[];
  bestSet: BestSet | null;
  currentE1rm: number | null; // most recent session's top-set e1RM
  startE1rm: number | null; // first logged session's top-set e1RM
  weeks: WeekBucket[];
  thisWeekVolume: number;
  lastWeekVolume: number;
  avgSessionVolume: number;
  totalSets: number;
  totalSessions: number;
  totalVolume: number;
  repPrs: RepPr[];
  lastTrainedAt: string | null;
  streakWeeks: number;
}

// Epley estimate. Reps are capped at 12 — the formula loses accuracy badly
// past ~12, and an AMRAP of 20 shouldn't claim an absurd 1RM.
export function epleyE1rm(weight: number, reps: number): number {
  const r = Math.min(Math.max(reps, 1), 12);
  return weight * (1 + r / 30);
}

// Working sets only: drop warmups and anything with no real load/reps.
export function workingSets(sets: StatSet[]): StatSet[] {
  return sets.filter((s) => !s.isWarmup && s.weight > 0 && s.reps > 0);
}

// ISO date (YYYY-MM-DD) of the Monday that owns `d`, evaluated in `tz`.
export function weekStart(d: Date, tz: string): string {
  const iso = isoDateInTz(d, tz);
  const dow = dayOfWeekInTz(d, tz); // 1 = Mon … 7 = Sun
  const u = new Date(iso + "T00:00:00Z");
  u.setUTCDate(u.getUTCDate() - (dow - 1));
  return u.toISOString().slice(0, 10);
}

// One e1RM point per session — the heaviest-estimate working set of that day.
export function e1rmSeries(sets: StatSet[]): E1rmPoint[] {
  const bySession = new Map<string, E1rmPoint>();
  for (const s of workingSets(sets)) {
    const e1rm = Math.round(epleyE1rm(s.weight, s.reps));
    const cur = bySession.get(s.sessionId);
    if (!cur || e1rm > cur.e1rm) {
      bySession.set(s.sessionId, {
        t: new Date(s.completedAt).getTime(),
        date: s.completedAt,
        e1rm,
        weight: s.weight,
        reps: s.reps,
        isAmrap: s.isAmrap,
      });
    }
  }
  return Array.from(bySession.values()).sort((a, b) => a.t - b.t);
}

// Heaviest e1RM set ever logged.
export function bestSet(sets: StatSet[]): BestSet | null {
  let best: BestSet | null = null;
  for (const s of workingSets(sets)) {
    const e1rm = Math.round(epleyE1rm(s.weight, s.reps));
    if (!best || e1rm > best.e1rm) {
      best = { weight: s.weight, reps: s.reps, e1rm, completedAt: s.completedAt, isAmrap: s.isAmrap };
    }
  }
  return best;
}

// Tonnage / set / session counts bucketed by training week.
export function weeklyBuckets(sets: StatSet[], tz: string): WeekBucket[] {
  const map = new Map<string, { volume: number; sets: number; sessions: Set<string> }>();
  for (const s of workingSets(sets)) {
    const wk = weekStart(new Date(s.completedAt), tz);
    const b = map.get(wk) ?? { volume: 0, sets: 0, sessions: new Set<string>() };
    b.volume += s.weight * s.reps;
    b.sets += 1;
    b.sessions.add(s.sessionId);
    map.set(wk, b);
  }
  return Array.from(map.entries())
    .map(([weekStart, b]) => ({
      weekStart,
      t: new Date(weekStart + "T00:00:00Z").getTime(),
      volume: Math.round(b.volume),
      sets: b.sets,
      sessions: b.sessions.size,
    }))
    .sort((a, b) => a.t - b.t);
}

// Heaviest weight hit for at least N reps, for each PR threshold.
export function repPrs(sets: StatSet[]): RepPr[] {
  const best: Record<number, { weight: number; reps: number; completedAt: string } | null> = {};
  for (const n of REP_PR_THRESHOLDS) best[n] = null;
  for (const s of workingSets(sets)) {
    for (const n of REP_PR_THRESHOLDS) {
      if (s.reps >= n) {
        const cur = best[n];
        if (!cur || s.weight > cur.weight) {
          best[n] = { weight: s.weight, reps: s.reps, completedAt: s.completedAt };
        }
      }
    }
  }
  return REP_PR_THRESHOLDS.map((n) => ({ reps: n, pr: best[n] }));
}

// Consecutive weeks (counting back from the most recent trained week) that
// had at least one session. The streak is "broken" — returns 0 — if the most
// recent trained week is more than one week before the current week.
export function trainingStreak(weekStarts: string[], todayWeekStart: string): number {
  const uniq = Array.from(new Set(weekStarts)).sort();
  if (uniq.length === 0) return 0;
  const WEEK = 7 * 86_400_000;
  const todayMs = new Date(todayWeekStart + "T00:00:00Z").getTime();
  const latestMs = new Date(uniq[uniq.length - 1] + "T00:00:00Z").getTime();
  if (Math.round((todayMs - latestMs) / WEEK) > 1) return 0;
  let streak = 1;
  for (let i = uniq.length - 1; i > 0; i--) {
    const cur = new Date(uniq[i] + "T00:00:00Z").getTime();
    const prev = new Date(uniq[i - 1] + "T00:00:00Z").getTime();
    if (Math.round((cur - prev) / WEEK) === 1) streak += 1;
    else break;
  }
  return streak;
}

// Bundle every stat the Lifts page needs for one lift.
export function computeLiftStats(sets: StatSet[], tz: string, today: Date = new Date()): LiftStats {
  const series = e1rmSeries(sets);
  const weeks = weeklyBuckets(sets, tz);
  const working = workingSets(sets);

  const totalVolume = weeks.reduce((sum, w) => sum + w.volume, 0);
  const totalSessions = new Set(working.map((s) => s.sessionId)).size;

  const todayWk = weekStart(today, tz);
  const lastWk = new Date(new Date(todayWk + "T00:00:00Z").getTime() - 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const lastTrainedAt = working.reduce<string | null>((latest, s) => {
    if (!latest || new Date(s.completedAt) > new Date(latest)) return s.completedAt;
    return latest;
  }, null);

  return {
    e1rmSeries: series,
    bestSet: bestSet(sets),
    currentE1rm: series.length ? series[series.length - 1].e1rm : null,
    startE1rm: series.length ? series[0].e1rm : null,
    weeks,
    thisWeekVolume: weeks.find((w) => w.weekStart === todayWk)?.volume ?? 0,
    lastWeekVolume: weeks.find((w) => w.weekStart === lastWk)?.volume ?? 0,
    avgSessionVolume: totalSessions ? Math.round(totalVolume / totalSessions) : 0,
    totalSets: working.length,
    totalSessions,
    totalVolume,
    repPrs: repPrs(sets),
    lastTrainedAt,
    streakWeeks: trainingStreak(
      weeks.map((w) => w.weekStart),
      todayWk,
    ),
  };
}
