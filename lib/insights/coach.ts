// AI coaching digest — pure, framework-agnostic glue between the existing
// Insights numbers and an LLM. Everything here is deterministic and testable:
// it builds a compact "facts" object (CoachContext) from data the app already
// computes, hashes it (to cache digests), and shapes the prompt + output
// schema. The actual network call lives in lib/ai/gemini.ts; persistence and
// data-gathering live in the server action.

import { epley, type InsightSet, type RegionVolume, type StrengthGroupResult } from "./muscle-model";

/* --------------------------- Output (the digest) --------------------------- */

export type CoachPriority = "high" | "medium" | "low";

export interface CoachItem {
  priority: CoachPriority;
  title: string; // short imperative, e.g. "Add rear-delt volume"
  detail: string; // 1-2 sentences, concrete and actionable
  tag?: string; // region or lift it relates to, e.g. "Rear delts" / "Bench"
}

export interface CoachDigest {
  headline: string; // one-line summary of the week
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

export interface CoachContext {
  bodyWeightLb: number | null;
  age: number | null;
  program: { week: number; block: string } | null;
  adherence: { sessionsLast7: number; sessionsLast14: number };
  strength: {
    lift: string;
    level: string | null;
    score: number | null; // % of bodyweight-scaled standard
    e1rm: number | null;
    trend: LiftTrend | null;
  }[];
  // Only regions that have meaningful signal (trained, or notably under/over).
  volume: {
    region: string;
    weeklySets: number;
    mev: number;
    mrv: number;
    status: RegionVolume["status"];
  }[];
}

// Benchmark exercises per scored lift, used to derive e1RM trend from logged
// sets. Mirrors the strength groups in muscle-model.ts.
const TREND_EXERCISES: Record<string, string[]> = {
  bench: ["Bench Press", "Bench Press 1RM Test"],
  squat: ["Back Squat"],
  ohp: ["Overhead Press", "Seated DB Press", "Arnold Press", "Machine Shoulder Press"],
  pullup: ["Weighted Pull-up"],
};

const DAY_MS = 86_400_000;

function effReps(set: InsightSet): number {
  return set.reps + Math.max(0, Math.min(5, set.rir ?? 0));
}

// Direction of a lift's best-per-session e1RM over recent sessions: compares the
// latest session to the mean of up to three prior ones. Needs >=2 sessions.
function liftTrend(sets: InsightSet[], exerciseNames: string[]): LiftTrend | null {
  const names = new Set(exerciseNames);
  const bestBySession = new Map<string, number>(); // keyed by completedAt date+ms bucket
  for (const s of sets) {
    if (s.isWarmup || s.reps <= 0 || !names.has(s.exerciseName)) continue;
    const e = epley(s.weight, effReps(s));
    const day = s.completedAt.slice(0, 10);
    if (e > (bestBySession.get(day) ?? 0)) bestBySession.set(day, e);
  }
  const series = Array.from(bestBySession.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, e]) => e);
  if (series.length < 2) return series.length === 1 ? "new" : null;
  const latest = series[series.length - 1];
  const prior = series.slice(Math.max(0, series.length - 4), series.length - 1);
  const baseline = prior.reduce((a, b) => a + b, 0) / prior.length;
  if (baseline <= 0) return "flat";
  if (latest > baseline * 1.025) return "up";
  if (latest < baseline * 0.975) return "down";
  return "flat";
}

export interface BuildContextArgs {
  sets: InsightSet[];
  volume: RegionVolume[];
  strength: StrengthGroupResult[];
  bodyWeightLb: number | null;
  age: number | null;
  program: { week: number; block: string } | null;
  now?: Date;
}

export function buildCoachContext({
  sets,
  volume,
  strength,
  bodyWeightLb,
  age,
  program,
  now = new Date(),
}: BuildContextArgs): CoachContext {
  const nowMs = now.getTime();

  // Adherence: count distinct training days within the windows.
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

  const strengthOut = strength.map((g) => ({
    lift: g.label,
    level: g.level,
    score: g.score,
    e1rm: g.e1rm,
    trend: liftTrend(sets, TREND_EXERCISES[g.key] ?? []),
  }));

  // Keep volume signal that's worth coaching on: anything trained this week, or
  // flagged under/over. Untrained-and-irrelevant regions are dropped to keep the
  // prompt tight and the advice focused.
  const volumeOut = volume
    .filter((v) => v.weeklySets > 0 || v.status === "under" || v.status === "over")
    .map((v) => ({
      region: v.label,
      weeklySets: v.weeklySets,
      mev: v.mev,
      mrv: v.mrv,
      status: v.status,
    }));

  return {
    bodyWeightLb: bodyWeightLb != null ? Math.round(bodyWeightLb) : null,
    age,
    program,
    adherence: { sessionsLast7: days7.size, sessionsLast14: days14.size },
    strength: strengthOut,
    volume: volumeOut,
  };
}

/* --------------------------------- Hashing -------------------------------- */

// Stable, dependency-free hash of the context so an unchanged data picture
// reuses the cached digest. FNV-1a over the canonical JSON — collisions are
// irrelevant here (worst case: a stale digest until the next data change).
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

export const COACH_SYSTEM_PROMPT = `You are a sharp, evidence-based strength coach reviewing one lifter's recent training data inside their tracking app. The lifter runs a 14-week block-periodization program centered on bench and squat, with accessory work tracked by muscle region.

You are given a JSON snapshot of their data:
- strength: each scored compound lift with its level, score (% of a bodyweight-scaled "intermediate" standard, where 100 = solid intermediate), estimated 1RM, and recent trend (up/flat/down/new).
- volume: weekly hard sets per muscle region vs MEV (minimum effective) and MRV (maximum recoverable) landmarks, with a status (under / optimal / over / untrained).
- adherence: training days in the last 7 and 14 days.
- bodyWeightLb, age, program week/block when known.

Write a short coaching digest: a one-line headline summarizing the week, then 2-4 prioritized action items. Rules:
- Be specific and reference the lifter's actual numbers (e.g. "rear delts at 3 sets, below the MEV of 6").
- Each item is one concrete action they can take next session. Prefer the highest-leverage fixes: regions under MEV, lifts trending down, or poor adherence.
- Suggest specific accessory exercises by name when recommending added volume (e.g. face pulls, reverse pec deck for rear delts).
- If a region is over MRV, consider recommending a pull-back, not just additions.
- Do not give medical, injury, or nutrition diagnoses. No fluff, no hype, no emoji.
- If the data is sparse (little logged), say so plainly and keep advice modest.
- "detail" is 1-2 sentences. "title" is a short imperative. "tag" names the region or lift.
- Order items highest priority first.`;

export function coachUserPrompt(ctx: CoachContext): string {
  return `Here is the lifter's current data snapshot:\n\n${JSON.stringify(ctx, null, 2)}\n\nReturn the coaching digest as JSON.`;
}
