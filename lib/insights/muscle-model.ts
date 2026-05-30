export type MuscleId =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "core";

export interface MuscleContribution {
  muscle: MuscleId;
  share: number;
}

export interface ExerciseModel {
  muscles: MuscleContribution[];
  fatigueHalfLifeHours: number;
  standardRatio: number;
}

export interface InsightSet {
  exerciseName: string;
  muscleGroup: string;
  weight: number;
  reps: number;
  rir: number | null;
  isWarmup: boolean;
  completedAt: string;
}

export interface MuscleInsight {
  muscle: MuscleId;
  label: string;
  // 0-100 recovery-adjusted fatigue. Absolute scale: a fully recovered muscle
  // reads ~0, a muscle hit hard within the last day reads high. NOT normalized
  // to the user's own peak, so "everything red" no longer happens.
  fatigue: number;
  // Hard (non-warmup) working sets credited to this muscle in the last 7 days,
  // weighted by each exercise's involvement share. Honest "effective sets".
  weeklySets: number;
  // Working-set tonnage (Σ weight×reps, lb) credited to this muscle, last 7 days.
  weeklyVolumeLb: number;
  strengthScore: number | null;
  bestExercise: string | null;
  bestE1rm: number | null;
  standardE1rm: number | null;
}

export const MUSCLE_LABELS: Record<MuscleId, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  core: "Core",
};

export const MUSCLE_ORDER: MuscleId[] = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
];

// Snapshot derived from:
// - Free Exercise DB exercise primary/secondary muscle schema and public-domain
//   exercise taxonomy.
// - Strength Level and FitnessVolt public strength-standard pages for common
//   lift/bodyweight relationships. Ratios are compacted to broad muscle groups
//   so the app never needs runtime scraping.
export const MUSCLE_MODEL_SOURCE = {
  updated: "2026-05-29",
  exerciseTaxonomy: "https://github.com/yuhonas/free-exercise-db",
  standards: [
    "https://strengthlevel.com/strength-standards",
    "https://fitnessvolt.com/strength-standards/",
  ],
};

const DEFAULT_HALF_LIFE = 42;

export const EXERCISE_MODELS: Record<string, ExerciseModel> = {
  "Bench Press": {
    muscles: [
      { muscle: "chest", share: 0.48 },
      { muscle: "triceps", share: 0.24 },
      { muscle: "shoulders", share: 0.18 },
      { muscle: "back", share: 0.1 },
    ],
    fatigueHalfLifeHours: 48,
    standardRatio: 1.0,
  },
  "Bench Press 1RM Test": {
    muscles: [
      { muscle: "chest", share: 0.5 },
      { muscle: "triceps", share: 0.24 },
      { muscle: "shoulders", share: 0.18 },
      { muscle: "back", share: 0.08 },
    ],
    fatigueHalfLifeHours: 60,
    standardRatio: 1.0,
  },
  "Close-Grip Bench Press": {
    muscles: [
      { muscle: "triceps", share: 0.4 },
      { muscle: "chest", share: 0.34 },
      { muscle: "shoulders", share: 0.16 },
      { muscle: "back", share: 0.1 },
    ],
    fatigueHalfLifeHours: 48,
    standardRatio: 0.82,
  },
  "Incline DB Press": {
    muscles: [
      { muscle: "chest", share: 0.46 },
      { muscle: "shoulders", share: 0.28 },
      { muscle: "triceps", share: 0.2 },
      { muscle: "back", share: 0.06 },
    ],
    fatigueHalfLifeHours: 40,
    standardRatio: 0.58,
  },
  "Weighted Dip": {
    muscles: [
      { muscle: "chest", share: 0.36 },
      { muscle: "triceps", share: 0.36 },
      { muscle: "shoulders", share: 0.18 },
      { muscle: "core", share: 0.1 },
    ],
    fatigueHalfLifeHours: 42,
    standardRatio: 0.34,
  },
  "Weighted Pull-up": {
    muscles: [
      { muscle: "back", share: 0.54 },
      { muscle: "biceps", share: 0.28 },
      { muscle: "shoulders", share: 0.08 },
      { muscle: "core", share: 0.1 },
    ],
    fatigueHalfLifeHours: 44,
    standardRatio: 0.32,
  },
  "Seated Cable Row": {
    muscles: [
      { muscle: "back", share: 0.58 },
      { muscle: "biceps", share: 0.2 },
      { muscle: "shoulders", share: 0.12 },
      { muscle: "core", share: 0.1 },
    ],
    fatigueHalfLifeHours: 38,
    standardRatio: 0.82,
  },
  "Chest-Supported Smith Row": {
    muscles: [
      { muscle: "back", share: 0.64 },
      { muscle: "biceps", share: 0.2 },
      { muscle: "shoulders", share: 0.16 },
    ],
    fatigueHalfLifeHours: 40,
    standardRatio: 0.9,
  },
  "Cable Lat Pullover": {
    muscles: [
      { muscle: "back", share: 0.72 },
      { muscle: "triceps", share: 0.1 },
      { muscle: "core", share: 0.18 },
    ],
    fatigueHalfLifeHours: 34,
    standardRatio: 0.38,
  },
  "One-Arm Lat Pulldown": {
    muscles: [
      { muscle: "back", share: 0.62 },
      { muscle: "biceps", share: 0.24 },
      { muscle: "shoulders", share: 0.08 },
      { muscle: "core", share: 0.06 },
    ],
    fatigueHalfLifeHours: 36,
    standardRatio: 0.52,
  },
  "Cable Face Pull": {
    muscles: [
      { muscle: "shoulders", share: 0.5 },
      { muscle: "back", share: 0.34 },
      { muscle: "biceps", share: 0.16 },
    ],
    fatigueHalfLifeHours: 28,
    standardRatio: 0.26,
  },
  "Reverse Pec Deck": {
    muscles: [
      { muscle: "shoulders", share: 0.62 },
      { muscle: "back", share: 0.28 },
      { muscle: "core", share: 0.1 },
    ],
    fatigueHalfLifeHours: 28,
    standardRatio: 0.28,
  },
  "Cable Lateral Raise": {
    muscles: [{ muscle: "shoulders", share: 1 }],
    fatigueHalfLifeHours: 26,
    standardRatio: 0.14,
  },
  "Overhead Press": {
    muscles: [
      { muscle: "shoulders", share: 0.48 },
      { muscle: "triceps", share: 0.26 },
      { muscle: "chest", share: 0.12 },
      { muscle: "core", share: 0.14 },
    ],
    fatigueHalfLifeHours: 46,
    standardRatio: 0.62,
  },
  "Hammer Curl": {
    muscles: [
      { muscle: "biceps", share: 0.72 },
      { muscle: "back", share: 0.08 },
      { muscle: "shoulders", share: 0.08 },
      { muscle: "core", share: 0.12 },
    ],
    fatigueHalfLifeHours: 28,
    standardRatio: 0.22,
  },
  "Incline DB Curl": {
    muscles: [
      { muscle: "biceps", share: 0.82 },
      { muscle: "shoulders", share: 0.08 },
      { muscle: "core", share: 0.1 },
    ],
    fatigueHalfLifeHours: 28,
    standardRatio: 0.2,
  },
  "Preacher Curl": {
    muscles: [
      { muscle: "biceps", share: 0.88 },
      { muscle: "core", share: 0.12 },
    ],
    fatigueHalfLifeHours: 30,
    standardRatio: 0.24,
  },
  "Overhead Cable Triceps Extension": {
    muscles: [
      { muscle: "triceps", share: 0.82 },
      { muscle: "shoulders", share: 0.08 },
      { muscle: "core", share: 0.1 },
    ],
    fatigueHalfLifeHours: 30,
    standardRatio: 0.27,
  },
  "Back Squat": {
    muscles: [
      { muscle: "quads", share: 0.42 },
      { muscle: "glutes", share: 0.24 },
      { muscle: "hamstrings", share: 0.12 },
      { muscle: "core", share: 0.14 },
      { muscle: "calves", share: 0.08 },
    ],
    fatigueHalfLifeHours: 60,
    standardRatio: 1.35,
  },
  "Bulgarian Split Squat": {
    muscles: [
      { muscle: "quads", share: 0.42 },
      { muscle: "glutes", share: 0.3 },
      { muscle: "hamstrings", share: 0.12 },
      { muscle: "core", share: 0.1 },
      { muscle: "calves", share: 0.06 },
    ],
    fatigueHalfLifeHours: 46,
    standardRatio: 0.34,
  },
  "Hack Squat": {
    muscles: [
      { muscle: "quads", share: 0.58 },
      { muscle: "glutes", share: 0.2 },
      { muscle: "hamstrings", share: 0.06 },
      { muscle: "core", share: 0.08 },
      { muscle: "calves", share: 0.08 },
    ],
    fatigueHalfLifeHours: 50,
    standardRatio: 1.45,
  },
  "Leg Extension": {
    muscles: [{ muscle: "quads", share: 1 }],
    fatigueHalfLifeHours: 34,
    standardRatio: 0.62,
  },
  "Romanian Deadlift": {
    muscles: [
      { muscle: "hamstrings", share: 0.44 },
      { muscle: "glutes", share: 0.28 },
      { muscle: "back", share: 0.14 },
      { muscle: "core", share: 0.14 },
    ],
    fatigueHalfLifeHours: 58,
    standardRatio: 1.05,
  },
  "Seated Leg Curl": {
    muscles: [{ muscle: "hamstrings", share: 1 }],
    fatigueHalfLifeHours: 34,
    standardRatio: 0.52,
  },
  "Standing Calf Raise": {
    muscles: [
      { muscle: "calves", share: 0.82 },
      { muscle: "core", share: 0.1 },
      { muscle: "hamstrings", share: 0.08 },
    ],
    fatigueHalfLifeHours: 32,
    standardRatio: 1.05,
  },
  "Weighted Hanging Leg Raise": {
    muscles: [
      { muscle: "core", share: 0.72 },
      { muscle: "quads", share: 0.12 },
      { muscle: "back", share: 0.1 },
      { muscle: "shoulders", share: 0.06 },
    ],
    fatigueHalfLifeHours: 30,
    standardRatio: 0.12,
  },
  "Ab Wheel Rollout": {
    muscles: [
      { muscle: "core", share: 0.76 },
      { muscle: "shoulders", share: 0.12 },
      { muscle: "back", share: 0.12 },
    ],
    fatigueHalfLifeHours: 34,
    standardRatio: 0.08,
  },
  "Weighted Cable Crunch": {
    muscles: [{ muscle: "core", share: 1 }],
    fatigueHalfLifeHours: 30,
    standardRatio: 0.42,
  },
};

export function epley(weight: number, reps: number): number {
  const r = Math.min(Math.max(reps, 1), 12);
  return weight * (1 + r / 30);
}

function fallbackModel(muscleGroup: string): ExerciseModel {
  const key = muscleGroup.toLowerCase();
  const muscle =
    key.includes("chest") ? "chest" :
    key.includes("back") || key.includes("lat") ? "back" :
    key.includes("shoulder") || key.includes("delt") ? "shoulders" :
    key.includes("bicep") ? "biceps" :
    key.includes("tricep") ? "triceps" :
    key.includes("quad") ? "quads" :
    key.includes("hamstring") ? "hamstrings" :
    key.includes("glute") ? "glutes" :
    key.includes("calf") || key.includes("calves") ? "calves" :
    "core";
  return { muscles: [{ muscle, share: 1 }], fatigueHalfLifeHours: DEFAULT_HALF_LIFE, standardRatio: 0.5 };
}

function ageFactor(age: number | null): number {
  if (!age || age < 35) return 1;
  if (age < 45) return 0.96;
  if (age < 55) return 0.88;
  if (age < 65) return 0.76;
  return 0.64;
}

const WEEK_MS = 7 * 24 * 3_600_000;
// One muscle accumulating this much recovery-weighted effective-set stress is
// treated as "fully fatigued" (fatigue = 100). Roughly: ~10 hard direct sets
// all performed in the last few hours. Picked so a typical heavy session of a
// muscle reads high (~60-90) right after, decaying toward 0 over a few days,
// while a rested muscle reads near 0. Absolute, not self-normalized.
const FULL_FATIGUE_STRESS = 10;

export function computeMuscleInsights(
  sets: InsightSet[],
  options: { bodyWeightLb: number | null; age: number | null; now?: Date },
): MuscleInsight[] {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const bodyWeight = Math.max(70, options.bodyWeightLb ?? 185);
  const ageAdj = ageFactor(options.age);

  // Recovery-weighted fatigue stress (drives the 0-100 fatigue gauge).
  const stress = new Map<MuscleId, number>();
  // Honest last-7-day working volume credited to each muscle by involvement share.
  const weeklySets = new Map<MuscleId, number>();
  const weeklyVolume = new Map<MuscleId, number>();
  const best = new Map<MuscleId, { exercise: string; e1rm: number; standard: number; score: number }>();

  for (const set of sets) {
    // Exclude warm-ups and empty sets from every stat. Warm-ups carry no
    // meaningful training stimulus and would inflate volume/fatigue.
    if (set.isWarmup || set.reps <= 0 || set.weight <= 0) continue;
    const model = EXERCISE_MODELS[set.exerciseName] ?? fallbackModel(set.muscleGroup);
    const estimated = epley(set.weight, set.reps);
    const ageMs = Math.max(0, nowMs - new Date(set.completedAt).getTime());
    const hoursAgo = ageMs / 3_600_000;
    const recovery = Math.pow(0.5, hoursAgo / model.fatigueHalfLifeHours);
    // RIR weighting: sets taken closer to failure are more fatiguing. A logged
    // RIR of 0 (true failure) is most stressful; high RIR (left reps in the
    // tank) least. Clamped so missing/odd values stay sane.
    const rir = set.rir == null ? 2 : Math.max(0, Math.min(5, set.rir));
    const rirFactor = Math.max(0.6, 1 - rir * 0.08);
    // One working set contributes ~1 "effective set" of stress, scaled by how
    // hard it was and how recently it was done. Volume-load no longer leaks in
    // via sqrt(weight×reps); that conflated load with set count.
    const setStress = rirFactor * recovery;
    const volumeLoad = set.weight * set.reps;
    const within7d = ageMs <= WEEK_MS;

    for (const c of model.muscles) {
      stress.set(c.muscle, (stress.get(c.muscle) ?? 0) + setStress * c.share);
      if (within7d) {
        weeklySets.set(c.muscle, (weeklySets.get(c.muscle) ?? 0) + c.share);
        weeklyVolume.set(c.muscle, (weeklyVolume.get(c.muscle) ?? 0) + volumeLoad * c.share);
      }
      const standard = bodyWeight * model.standardRatio * ageAdj;
      const score = estimated / Math.max(1, standard);
      const current = best.get(c.muscle);
      if (!current || score > current.score) {
        best.set(c.muscle, { exercise: set.exerciseName, e1rm: estimated, standard, score });
      }
    }
  }

  return MUSCLE_ORDER.map((muscle) => {
    const b = best.get(muscle);
    const s = stress.get(muscle) ?? 0;
    return {
      muscle,
      label: MUSCLE_LABELS[muscle],
      fatigue: Math.max(0, Math.min(100, Math.round((s / FULL_FATIGUE_STRESS) * 100))),
      weeklySets: Math.round((weeklySets.get(muscle) ?? 0) * 10) / 10,
      weeklyVolumeLb: Math.round(weeklyVolume.get(muscle) ?? 0),
      strengthScore: b ? Math.round(b.score * 100) : null,
      bestExercise: b?.exercise ?? null,
      bestE1rm: b ? Math.round(b.e1rm) : null,
      standardE1rm: b ? Math.round(b.standard) : null,
    };
  });
}
