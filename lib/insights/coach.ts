// AI coaching digest — pure, framework-agnostic glue between the existing
// Insights numbers and an LLM. Everything here is deterministic and testable:
// it builds a compact "facts" object (CoachContext) from data the app already
// computes, hashes it (to cache digests), and shapes the prompt + output
// schema. The network call lives in lib/ai/gemini.ts; persistence and data-
// gathering live in the server action.
//
// IMPORTANT framing: BenchPilot runs a bench+squat *specialization* block. High
// pressing volume is intended, not a bug — so this coach leads with "is the
// bench actually moving, and is recovery holding?" and treats generic over-MRV
// landmarks as a fatigue WATCH, never an automatic "cut pressing" order.

import {
  epley,
  type InsightSet,
  type LiftName,
  type RegionVolume,
  type StrengthGroupResult,
} from "./muscle-model";

/* --------------------------- Output (the digest) --------------------------- */

export type CoachPriority = "high" | "medium" | "low";

export interface CoachItem {
  priority: CoachPriority;
  title: string; // short imperative, e.g. "Keep pressing — bench is climbing"
  detail: string; // 1-2 sentences, concrete and actionable
  tag?: string; // region or lift it relates to, e.g. "Bench" / "Rear delts"
}

export interface CoachDigest {
  headline: string; // one-line read on the week
  items: CoachItem[]; // 2-4, highest priority first
}

// Gemini responseSchema (OpenAPI subset) forcing the shape above.
export const COACH_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          priority: { type: "string", enum: ["high", "medium", "low"] },
          title: { type: "string" },
          detail: { type: "string" },
          tag: { type: "string" },
        },
        required: ["priority", "title", "detail"],
      },
    },
  },
  required: ["headline", "items"],
} as const;

/* ------------------------------- Input (facts) ----------------------------- */

export type LiftTrend = "up" | "flat" | "down" | "new";
export type RirTrend = "rising" | "steady" | "falling";

export interface MainLiftSignal {
  lift: string; // label, e.g. "Bench Press"
  level: string | null; // strength level (Beginner..Elite)
  score: number | null; // % of bodyweight-scaled standard
  e1rm: number | null; // current best estimate
  startE1rm: number | null; // first logged session
  trend: LiftTrend | null; // direction of recent e1RM
  sessionsLogged: number;
  // Top-set reps-in-reserve direction. "falling" = sets grinding closer to
  // failure at working loads (fatigue accumulating); "rising" = more in reserve.
  topSetRirTrend: RirTrend | null;
  lastAmrapReps: number | null; // most recent AMRAP top-set reps
  trainingMax: number | null;
  recentTmBumps: number; // TM increases in the last ~6 weeks
  projectedTestE1rm: number | null; // linear projection to the test week
}

export interface AssistanceSignal {
  name: string;
  e1rm: number;
  trend: LiftTrend | null;
}

export interface VolumeSignal {
  region: string;
  weeklySets: number;
  mev: number;
  mrv: number;
  status: RegionVolume["status"];
  emphasis: boolean; // a muscle the bench block intentionally overloads
}

export interface CoachContext {
  program: { week: number; totalWeeks: number; block: string; weeksToTest: number } | null;
  bodyWeightLb: number | null;
  age: number | null;
  adherence: { sessionsLast7: number; sessionsLast14: number };
  // The lifts the program is built around — bench first.
  mainLifts: MainLiftSignal[];
  // Bench assistance, for weak-point reasoning when the press stalls.
  benchAssistance: AssistanceSignal[];
  volume: VolumeSignal[];
  // Pre-computed so the model doesn't have to: is there a real reason to back
  // off pressing (progress stalling AND sets grinding), vs just "over a generic
  // landmark"? Only this should ever justify cutting emphasis volume.
  recoveryConcern: boolean;
}

// The program's focus lifts, with their strength-group key and benchmark logged
// exercises.
const MAIN_LIFTS: { key: string; label: string; liftName: LiftName; exercises: string[] }[] = [
  { key: "bench", label: "Bench Press", liftName: "bench_press", exercises: ["Bench Press", "Bench Press 1RM Test"] },
  { key: "squat", label: "Back Squat", liftName: "back_squat", exercises: ["Back Squat"] },
];

// Exercises that drive the bench (used for weak-point diagnosis).
const BENCH_ASSISTANCE = [
  "Close-Grip Bench Press",
  "Incline DB Press",
  "Weighted Dip",
  "Overhead Press",
  "Overhead Cable Triceps Extension",
];

// Regions the bench block intentionally overloads — over-MRV here is expected.
const EMPHASIS_REGIONS = new Set(["chest", "triceps", "front_delt"]);

const DAY_MS = 86_400_000;

function effReps(set: InsightSet): number {
  return set.reps + Math.max(0, Math.min(5, set.rir ?? 0));
}

// Best e1RM per training day for the given exercises, oldest → newest.
function e1rmByDay(sets: InsightSet[], names: Set<string>): number[] {
  const m = new Map<string, number>();
  for (const s of sets) {
    if (s.isWarmup || s.reps <= 0 || !names.has(s.exerciseName)) continue;
    const e = epley(s.weight, effReps(s));
    const day = s.completedAt.slice(0, 10);
    if (e > (m.get(day) ?? 0)) m.set(day, e);
  }
  return Array.from(m.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, e]) => e);
}

function trendFromSeries(series: number[]): LiftTrend | null {
  if (series.length < 2) return series.length === 1 ? "new" : null;
  const latest = series[series.length - 1];
  const prior = series.slice(Math.max(0, series.length - 4), series.length - 1);
  const base = prior.reduce((a, b) => a + b, 0) / prior.length;
  if (base <= 0) return "flat";
  if (latest > base * 1.025) return "up";
  if (latest < base * 0.975) return "down";
  return "flat";
}

// Top-set (heaviest working set) RIR per day, oldest → newest, nulls dropped.
function topSetRirByDay(sets: InsightSet[], names: Set<string>): number[] {
  const byDay = new Map<string, { w: number; rir: number | null }>();
  for (const s of sets) {
    if (s.isWarmup || s.reps <= 0 || !names.has(s.exerciseName)) continue;
    const day = s.completedAt.slice(0, 10);
    const cur = byDay.get(day);
    if (!cur || s.weight > cur.w) byDay.set(day, { w: s.weight, rir: s.rir });
  }
  return Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => v.rir)
    .filter((r): r is number => r != null);
}

function rirTrendFrom(rirs: number[]): RirTrend | null {
  if (rirs.length < 3) return null;
  const recent = rirs.slice(-2);
  const earlier = rirs.slice(0, -2);
  const ra = recent.reduce((a, b) => a + b, 0) / recent.length;
  const ea = earlier.reduce((a, b) => a + b, 0) / earlier.length;
  if (ra < ea - 0.5) return "falling"; // fewer reps in reserve = grinding harder
  if (ra > ea + 0.5) return "rising";
  return "steady";
}

function latestAmrapReps(sets: InsightSet[], names: Set<string>): number | null {
  let best: { t: number; reps: number } | null = null;
  for (const s of sets) {
    if (!s.isAmrap || s.isWarmup || s.reps <= 0 || !names.has(s.exerciseName)) continue;
    const t = new Date(s.completedAt).getTime();
    if (!best || t > best.t) best = { t, reps: s.reps };
  }
  return best?.reps ?? null;
}

function projectTestE1rm(
  series: number[],
  weeksElapsed: number,
  weeksRemaining: number,
): number | null {
  if (series.length < 2 || weeksRemaining <= 0) return null;
  const start = series[0];
  const current = series[series.length - 1];
  const elapsed = Math.max(1, weeksElapsed);
  const ratePerWeek = (current - start) / elapsed;
  const projected = current + ratePerWeek * weeksRemaining;
  // Keep the projection sane — never below 90% of current or above 150%.
  return Math.round(Math.max(current * 0.9, Math.min(current * 1.5, projected)));
}

export interface TmInfo {
  liftName: LiftName;
  trainingMax: number | null;
  recentBumps: number; // bumps in the last ~6 weeks
}

export interface BuildContextArgs {
  // ALL completed working sets (not date-filtered); volume re-windows internally.
  sets: InsightSet[];
  volume: RegionVolume[];
  strength: StrengthGroupResult[];
  bodyWeightLb: number | null;
  age: number | null;
  program: { week: number; totalWeeks: number; block: string } | null;
  tmInfo: TmInfo[];
  now?: Date;
}

export function buildCoachContext({
  sets,
  volume,
  strength,
  bodyWeightLb,
  age,
  program,
  tmInfo,
  now = new Date(),
}: BuildContextArgs): CoachContext {
  const nowMs = now.getTime();

  // Adherence: distinct training days within the windows.
  const days7 = new Set<string>();
  const days14 = new Set<string>();
  for (const s of sets) {
    if (s.isWarmup) continue;
    const ageMs = nowMs - new Date(s.completedAt).getTime();
    if (ageMs < 0) continue;
    const day = s.completedAt.slice(0, 10);
    if (ageMs <= 14 * DAY_MS) days14.add(day);
    if (ageMs <= 7 * DAY_MS) days7.add(day);
  }

  const strengthByKey = new Map(
    strength.map((g) => [g.label, g]),
  );
  const weeksToTest = program ? Math.max(0, program.totalWeeks - program.week) : 0;
  const weeksElapsed = program ? Math.max(1, program.week - 1) : 1;

  const mainLifts: MainLiftSignal[] = MAIN_LIFTS.map((m) => {
    const names = new Set(m.exercises);
    const series = e1rmByDay(sets, names);
    const grp = strengthByKey.get(m.label);
    const rirs = topSetRirByDay(sets, names);
    const tm = tmInfo.find((t) => t.liftName === m.liftName);
    return {
      lift: m.label,
      level: grp?.level ?? null,
      score: grp?.score ?? null,
      e1rm: grp?.e1rm ?? (series.length ? Math.round(series[series.length - 1]) : null),
      startE1rm: series.length ? Math.round(series[0]) : null,
      trend: trendFromSeries(series),
      sessionsLogged: series.length,
      topSetRirTrend: rirTrendFrom(rirs),
      lastAmrapReps: latestAmrapReps(sets, names),
      trainingMax: tm?.trainingMax ?? null,
      recentTmBumps: tm?.recentBumps ?? 0,
      projectedTestE1rm: projectTestE1rm(series, weeksElapsed, weeksToTest),
    };
  });

  // Bench assistance trends for weak-point reasoning.
  const benchAssistance: AssistanceSignal[] = BENCH_ASSISTANCE.map((name) => {
    const series = e1rmByDay(sets, new Set([name]));
    if (!series.length) return null;
    return {
      name,
      e1rm: Math.round(series[series.length - 1]),
      trend: trendFromSeries(series),
    };
  }).filter((x): x is AssistanceSignal => x !== null);

  const volumeOut: VolumeSignal[] = volume
    .filter((v) => v.weeklySets > 0 || v.status === "under" || v.status === "over")
    .map((v) => ({
      region: v.label,
      weeklySets: v.weeklySets,
      mev: v.mev,
      mrv: v.mrv,
      status: v.status,
      emphasis: EMPHASIS_REGIONS.has(v.region),
    }));

  // Real reason to back off pressing: bench progress is stalling AND top sets
  // are grinding (or trending down). Generic over-MRV alone never qualifies.
  const bench = mainLifts.find((l) => l.lift === "Bench Press");
  const recoveryConcern = Boolean(
    bench &&
      (bench.trend === "down" ||
        (bench.trend === "flat" && bench.topSetRirTrend === "falling")),
  );

  return {
    program: program ? { ...program, weeksToTest } : null,
    bodyWeightLb: bodyWeightLb != null ? Math.round(bodyWeightLb) : null,
    age,
    adherence: { sessionsLast7: days7.size, sessionsLast14: days14.size },
    mainLifts,
    benchAssistance,
    volume: volumeOut,
    recoveryConcern,
  };
}

/* --------------------------------- Hashing -------------------------------- */

// Stable, dependency-free hash of the context so an unchanged data picture
// reuses the cached digest. FNV-1a over the canonical JSON.
export function hashCoachContext(ctx: CoachContext): string {
  const json = JSON.stringify(ctx);
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/* --------------------------------- Prompt --------------------------------- */

export const COACH_SYSTEM_PROMPT = `You are a sharp strength coach reviewing one lifter's data inside their training app. Be specific, honest, and useful — no fluff, no hype, no emoji.

CRITICAL CONTEXT — read before judging anything:
This is a 14-week BENCH + SQUAT SPECIALIZATION program. The whole point is to drive the bench up. That means PRESSING VOLUME IS HIGH BY DESIGN. Chest, triceps, and front delts (marked emphasis: true) will routinely sit AT OR OVER generic MRV landmarks. That is expected and correct — it is NOT a problem to fix. Do NOT tell the lifter to cut pressing volume just because a muscle is "over MRV". The generic MRV number is a fatigue WATCH line on this program, not a ceiling.

The ONLY time you should suggest pulling back pressing is when recoveryConcern is true (the bench is stalling/regressing AND top sets are grinding closer to failure). If recoveryConcern is false, treat high pressing as on-plan and do not flag it.

Lead your digest with the question that actually matters: IS THE BENCH MOVING, and is recovery holding? Use the data:
- mainLifts: per focus lift — level, score (% of a bodyweight-scaled intermediate standard, 100 = solid intermediate), current e1RM, startE1rm, trend (up/flat/down/new), topSetRirTrend ("falling" = sets grinding closer to failure = fatigue; "rising" = easier/more in reserve), lastAmrapReps, trainingMax, recentTmBumps, projectedTestE1rm (linear projection to the test week).
- benchAssistance: trends of the lifts that drive the bench — use these for WEAK-POINT diagnosis. If the bench is flat/down, point at the likely limiter: lagging triceps work (Close-Grip, Overhead Triceps Extension) → lockout; lagging incline/dip/OHP → off-the-chest/upper-pec & front-delt strength. Recommend bumping the specific lagging assistance, not generic advice.
- volume: weekly hard sets per region vs MEV/MRV with a status and an emphasis flag. UNDER-MEV non-emphasis regions (rear delts, side delts, upper back, lats, traps) are the real opportunity — for a bencher these support the press and protect the shoulders. Recommend specific accessories (face pulls, reverse pec deck, chest-supported rows, lateral raises).
- program: week / totalWeeks / weeksToTest — factor the timeline in. Early block: build. Near test week: sharpen, don't add fatigue.
- adherence: training days in the last 7/14.

Output: a one-line headline summarizing the week, then 2-4 prioritized action items, highest priority first. Each item: a short imperative "title", a 1-2 sentence "detail" that cites the lifter's actual numbers, and a "tag" naming the lift or region. If the bench is progressing well, SAY SO and tell them to keep going — confirmation is valuable. If data is sparse, say so plainly and keep advice modest. No medical, injury, or nutrition diagnoses.`;

export function coachUserPrompt(ctx: CoachContext): string {
  return `Here is the lifter's current data snapshot:\n\n${JSON.stringify(ctx, null, 2)}\n\nReturn the coaching digest as JSON. Remember: high pressing volume is intended on this bench specialization program — only flag it if recoveryConcern is true.`;
}
