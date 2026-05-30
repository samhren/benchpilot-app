// Pre-gym warm-up routines. Pure data + a session-type → routine mapping.
// Shown before a workout begins when the user enables it in Settings.

export interface WarmupItem {
  label: string;
  detail?: string;
  // When present, the step shows a countdown timer (seconds). Otherwise it's a
  // rep/mobility step the user marks done manually.
  durationSec?: number;
}

export interface WarmupRoutine {
  // Human label for the day this warm-up is tailored to.
  focus: string;
  items: WarmupItem[];
}

// Every-day general primer (~5 min).
const GENERAL: WarmupItem[] = [
  {
    label: "Easy bike or incline walk",
    detail: "Light cardio — just get the blood moving",
    durationSec: 5 * 60,
  },
  { label: "Leg swings", detail: "10 per leg — front-back + side-side" },
  { label: "Arm circles + band pull-aparts", detail: "15 each" },
];

// Day-specific additions, keyed by sessionType.
const HEAVY_BENCH: WarmupItem[] = [
  { label: "Band shoulder dislocates", detail: "10 reps" },
  { label: "Push-ups", detail: "10 reps" },
  { label: "Scap push-ups", detail: "10 reps" },
  { label: "Empty bar bench", detail: "10 reps" },
];

const VOLUME_BENCH: WarmupItem[] = [
  { label: "Band pull-aparts", detail: "20 reps" },
  { label: "Band shoulder dislocates", detail: "10 reps" },
  { label: "Push-ups", detail: "10 reps" },
  { label: "Empty bar bench", detail: "10 reps" },
];

const BENCH_AMRAP: WarmupItem[] = [
  { label: "Band pull-aparts", detail: "20 reps" },
  { label: "Push-ups", detail: "10 reps" },
  { label: "Empty bar bench", detail: "10 reps" },
];

const SQUAT: WarmupItem[] = [
  { label: "Bodyweight squats", detail: "10 reps — progressively deeper" },
  { label: "Couch stretch", detail: "30 sec per side", durationSec: 60 },
  { label: "Glute bridges", detail: "2 × 10" },
  { label: "Banded clamshells", detail: "2 × 15 per side" },
  { label: "Leg extension", detail: "2 × 15 light — knee prep" },
];

const HINGE: WarmupItem[] = [
  { label: "Cat-cow", detail: "10 reps" },
  { label: "Couch stretch", detail: "30 sec per side", durationSec: 60 },
  { label: "Glute bridges", detail: "2 × 10" },
  { label: "Bird dogs", detail: "2 × 8 per side" },
  { label: "Light RDL w/ empty bar", detail: "10 reps" },
];

const DAY: Record<string, { focus: string; additions: WarmupItem[] }> = {
  upper_a: { focus: "Heavy Bench", additions: HEAVY_BENCH },
  upper_b: { focus: "Volume Bench", additions: VOLUME_BENCH },
  upper_c: { focus: "Bench AMRAP", additions: BENCH_AMRAP },
  lower_a: { focus: "Squat", additions: SQUAT },
  lower_b: { focus: "Hinge / RDL", additions: HINGE },
  // Test week is bench-centric → prime the press.
  test: { focus: "Bench Test", additions: BENCH_AMRAP },
};

/**
 * Build the warm-up routine for a given session type. The general primer always
 * runs first, followed by day-specific mobility/activation work. Unknown or
 * deload days fall back to the general primer only.
 */
export function getWarmupRoutine(sessionType: string): WarmupRoutine {
  const day = DAY[sessionType];
  return {
    focus: day?.focus ?? "Mobility",
    items: [...GENERAL, ...(day?.additions ?? [])],
  };
}
