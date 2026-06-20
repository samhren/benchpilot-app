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
  // What the program last PRESCRIBED for this lift (weight × reps, % of TM).
  // Sub-maximal by design — the lifter's real ceiling is trainingMax / e1rm, NOT
  // this. Present so the coach never mistakes a programmed back-off for a max.
  lastPrescribed: PrescribedTopSet | null;
  // How many of the logged days for this lift were genuine max efforts (AMRAP /
  // near-failure / test) — i.e. how much real strength signal the trend rests on.
  maxEffortDays: number;
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

// Is this a genuine MAX-strength signal, vs a programmed sub-maximal set?
// On a % -of-training-max wave program the prescribed top sets are deliberately
// NOT taken to failure — their raw e1RM tracks the wave (the prescribed %), not
// the lifter, so they must not feed the strength trend. Only count:
//   • AMRAP top sets (open-ended reps → real performance signal),
//   • sets taken near failure (RIR ≤ 1 → a true effort), or
//   • 1RM test attempts.
// This is what stops a programmed "205×3" from reading as the bench regressing.
function isStrengthEffort(s: InsightSet): boolean {
  if (s.isWarmup || s.reps <= 0) return false;
  if (s.isAmrap) return true;
  if (s.exerciseName.includes("1RM Test")) return true;
  return s.rir != null && s.rir <= 1;
}

// Best e1RM per training day for the given exercises, oldest → newest.
// `onlyMaxEfforts` restricts to genuine strength signals (see isStrengthEffort)
// — used for the main lifts so programmed sub-maximal work can't drag the trend.
function e1rmByDay(sets: InsightSet[], names: Set<string>, onlyMaxEfforts = false): number[] {
  const m = new Map<string, number>();
  for (const s of sets) {
    if (s.isWarmup || s.reps <= 0 || !names.has(s.exerciseName)) continue;
    if (onlyMaxEfforts && !isStrengthEffort(s)) continue;
    const e = epley(s.weight, effReps(s));
    const day = s.completedAt.slice(0, 10);
    if (e > (m.get(day) ?? 0)) m.set(day, e);
  }
  return Array.from(m.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, e]) => e);
}

// The most recent PRESCRIBED top set for a lift — what the program last told the
// lifter to do (weight × reps and the % of training max). Surfaced so the coach
// understands a low logged e1RM is a programmed back-off, not a failed max.
interface PrescribedTopSet {
  weight: number;
  reps: number;
  percentageOfTm: number | null;
}
function lastPrescribedTopSet(sets: InsightSet[], names: Set<string>): PrescribedTopSet | null {
  let day: string | null = null;
  for (const s of sets) {
    if (s.isWarmup || !names.has(s.exerciseName) || s.weightPrescribed == null) continue;
    const d = s.completedAt.slice(0, 10);
    if (day == null || d > day) day = d;
  }
  if (day == null) return null;
  let best: PrescribedTopSet | null = null;
  for (const s of sets) {
    if (s.isWarmup || !names.has(s.exerciseName) || s.weightPrescribed == null) continue;
    if (s.completedAt.slice(0, 10) !== day) continue;
    if (!best || s.weightPrescribed > best.weight) {
      best = {
        weight: Math.round(s.weightPrescribed),
        reps: s.repsPrescribed ?? s.reps,
        percentageOfTm: s.percentageOfTm ?? null,
      };
    }
  }
  return best;
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
    // Strength trend rests ONLY on genuine max efforts (AMRAP / near-failure /
    // test) so programmed sub-maximal waves can't fake a regression. Fall back to
    // the full series purely for a display e1RM when no max efforts exist yet.
    const strengthSeries = e1rmByDay(sets, names, true);
    const anySeries = e1rmByDay(sets, names);
    const grp = strengthByKey.get(m.label);
    const rirs = topSetRirByDay(sets, names);
    const tm = tmInfo.find((t) => t.liftName === m.liftName);
    const displayE1rm =
      grp?.e1rm ??
      (strengthSeries.length
        ? Math.round(strengthSeries[strengthSeries.length - 1])
        : anySeries.length
          ? Math.round(anySeries[anySeries.length - 1])
          : null);
    return {
      lift: m.label,
      level: grp?.level ?? null,
      score: grp?.score ?? null,
      e1rm: displayE1rm,
      startE1rm: strengthSeries.length ? Math.round(strengthSeries[0]) : null,
      trend: trendFromSeries(strengthSeries),
      sessionsLogged: anySeries.length,
      topSetRirTrend: rirTrendFrom(rirs),
      lastAmrapReps: latestAmrapReps(sets, names),
      trainingMax: tm?.trainingMax ?? null,
      recentTmBumps: tm?.recentBumps ?? 0,
      projectedTestE1rm: projectTestE1rm(strengthSeries, weeksElapsed, weeksToTest),
      lastPrescribed: lastPrescribedTopSet(sets, names),
      maxEffortDays: strengthSeries.length,
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

HOW TO READ STRENGTH — DO NOT GET THIS WRONG:
This is a percentage-of-training-max wave program. Almost every prescribed main-lift set is SUB-MAXIMAL BY DESIGN — the program tells the lifter to do, say, 205×3 at ~75% of their training max. That is NOT a max attempt and says nothing about whether they got weaker. NEVER infer regression from the weight or reps of a programmed set. Read the fields exactly as defined:
- trainingMax is the program's working anchor and e1rm is the lifter's best estimated one-rep max. THESE are the real strength numbers. A lifter benching a programmed 205×3 may well have a trainingMax of 245+ — judge their bench off trainingMax / e1rm / lastPrescribed.percentageOfTm, never off the raw programmed load.
- lastPrescribed = {weight, reps, percentageOfTm}: what the program last PRESCRIBED for that lift. It is the planned dose, not a ceiling. If percentageOfTm is well under 100, of course the weight is below their max — that is the plan working, not a problem.
- trend is computed ONLY from genuine max efforts (AMRAP sets, near-failure sets, and 1RM tests) — programmed sub-maximal sets are excluded, so trend is a HONEST strength direction. maxEffortDays tells you how many such efforts it rests on: if it is 0 or 1, trend is "new" — say strength is "too early to call from the data," do NOT claim regression, and lean on trainingMax, recentTmBumps and lastAmrapReps instead.
- The true progress signals on this program are: training max going up (recentTmBumps > 0), AMRAP sets beating their prescribed reps (lastAmrapReps vs lastPrescribed.reps), and trend = up. If the bench is flat with few max efforts, that is normal mid-block accumulation, not a stall.

Lead your digest with the question that actually matters: IS THE BENCH MOVING, and is recovery holding? Use the data:
- mainLifts: per focus lift — level, score (% of a bodyweight-scaled intermediate standard, 100 = solid intermediate), current e1RM (real estimated max), startE1rm, trend (up/flat/down/new — max efforts only), maxEffortDays (how much real signal the trend has), topSetRirTrend ("falling" = sets grinding closer to failure = fatigue; "rising" = easier/more in reserve), lastAmrapReps, lastPrescribed (the program's last prescribed top set — sub-maximal by design), trainingMax, recentTmBumps, projectedTestE1rm (linear projection to the test week).
- benchAssistance: trends of the lifts that drive the bench — use these for WEAK-POINT diagnosis. If the bench is flat/down, point at the likely limiter: lagging triceps work (Close-Grip, Overhead Triceps Extension) → lockout; lagging incline/dip/OHP → off-the-chest/upper-pec & front-delt strength. Recommend bumping the specific lagging assistance, not generic advice.
- volume: weekly hard sets per region vs MEV/MRV with a status and an emphasis flag. UNDER-MEV non-emphasis regions (rear delts, side delts, upper back, lats, traps) are the real opportunity — for a bencher these support the press and protect the shoulders. Recommend specific accessories (face pulls, reverse pec deck, chest-supported rows, lateral raises).
- program: week / totalWeeks / weeksToTest — factor the timeline in. Early block: build. Near test week: sharpen, don't add fatigue.
- adherence: training days in the last 7/14.

Output: a one-line headline summarizing the week, then 2-4 prioritized action items, highest priority first. Each item: a short imperative "title", a 1-2 sentence "detail" that cites the lifter's actual numbers, and a "tag" naming the lift or region. If the bench is progressing well, SAY SO and tell them to keep going — confirmation is valuable. If data is sparse, say so plainly and keep advice modest. No medical, injury, or nutrition diagnoses.`;

export function coachUserPrompt(ctx: CoachContext): string {
  return `Here is the lifter's current data snapshot:\n\n${JSON.stringify(ctx, null, 2)}\n\nReturn the coaching digest as JSON. Remember: (1) prescribed main-lift loads (lastPrescribed) are sub-maximal % -of-training-max work — judge bench strength off trainingMax / e1rm / trend, NEVER off a programmed set's weight; (2) high pressing volume is intended on this bench specialization program — only flag it if recoveryConcern is true.`;
}
