// Insights data model. Two independent, separately-sourced views:
//
//  1. VOLUME / BALANCE — per muscle *region* (delts split front/side/rear, back
//     split lats/upper-back/traps). Weekly hard sets are share-weighted and
//     compared to published volume landmarks (MEV/MRV). Good data exists here.
//
//  2. STRENGTH — anchored ONLY to compound lifts that have real strength
//     standards (bench, OHP, squat, deadlift, weighted pull-up) scored vs a
//     bodyweight-relative standard. Isolation movements are deliberately NOT
//     scored for strength: there is no credible "rear-delt 1RM standard", and
//     letting a pec-deck define "back strength" produced nonsense (e.g. 271%).
//
// Strength standards are male-oriented (the app has no sex field) and are
// bodyweight/age-scaled. Volume landmarks follow Renaissance Periodization's
// published per-muscle ranges. Sources in MUSCLE_MODEL_SOURCE.

export type RegionId =
  | "chest"
  | "front_delt"
  | "side_delt"
  | "rear_delt"
  | "lats"
  | "upper_back"
  | "traps"
  | "biceps"
  | "triceps"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "core";

export type RegionGroup = "Push" | "Shoulders" | "Back" | "Arms" | "Legs" | "Core";

export interface RegionContribution {
  region: RegionId;
  share: number;
}

export interface ExerciseModel {
  regions: RegionContribution[];
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

export const REGION_LABELS: Record<RegionId, string> = {
  chest: "Chest",
  front_delt: "Front delts",
  side_delt: "Side delts",
  rear_delt: "Rear delts",
  lats: "Lats",
  upper_back: "Upper back",
  traps: "Traps",
  biceps: "Biceps",
  triceps: "Triceps",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  core: "Core",
};

export const REGION_GROUP: Record<RegionId, RegionGroup> = {
  chest: "Push",
  triceps: "Push",
  front_delt: "Shoulders",
  side_delt: "Shoulders",
  rear_delt: "Shoulders",
  lats: "Back",
  upper_back: "Back",
  traps: "Back",
  biceps: "Arms",
  quads: "Legs",
  hamstrings: "Legs",
  glutes: "Legs",
  calves: "Legs",
  core: "Core",
};

export const REGION_ORDER: RegionId[] = [
  "chest",
  "triceps",
  "front_delt",
  "side_delt",
  "rear_delt",
  "lats",
  "upper_back",
  "traps",
  "biceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
];

// Weekly hard-set landmarks (share-weighted effective sets, last 7 days).
// mev = minimum effective volume, mrv = maximum recoverable volume. The
// mev..mrv band is the productive range. Approximated from Renaissance
// Periodization's published per-muscle landmarks.
export const VOLUME_LANDMARKS: Record<RegionId, { mev: number; mrv: number }> = {
  chest: { mev: 8, mrv: 22 },
  front_delt: { mev: 4, mrv: 12 }, // heavily covered by pressing
  side_delt: { mev: 8, mrv: 26 },
  rear_delt: { mev: 6, mrv: 24 },
  lats: { mev: 10, mrv: 22 },
  upper_back: { mev: 10, mrv: 25 },
  traps: { mev: 4, mrv: 20 },
  biceps: { mev: 8, mrv: 26 },
  triceps: { mev: 8, mrv: 18 },
  quads: { mev: 8, mrv: 20 },
  hamstrings: { mev: 6, mrv: 20 },
  glutes: { mev: 4, mrv: 16 },
  calves: { mev: 8, mrv: 20 },
  core: { mev: 6, mrv: 25 },
};

export const MUSCLE_MODEL_SOURCE = {
  updated: "2026-05-30",
  exerciseTaxonomy: "https://github.com/yuhonas/free-exercise-db",
  strengthStandards: [
    "https://strengthlevel.com/strength-standards",
    "https://symmetricstrength.com",
  ],
  volumeLandmarks: "Renaissance Periodization per-muscle MEV/MRV landmarks",
};

// Per-exercise region involvement. Shares are a rough split of the training
// stimulus and sum to ~1 per exercise.
export const EXERCISE_MODELS: Record<string, ExerciseModel> = {
  "Bench Press": {
    regions: [
      { region: "chest", share: 0.5 },
      { region: "triceps", share: 0.26 },
      { region: "front_delt", share: 0.24 },
    ],
  },
  "Bench Press 1RM Test": {
    regions: [
      { region: "chest", share: 0.52 },
      { region: "triceps", share: 0.24 },
      { region: "front_delt", share: 0.24 },
    ],
  },
  "Close-Grip Bench Press": {
    regions: [
      { region: "triceps", share: 0.42 },
      { region: "chest", share: 0.34 },
      { region: "front_delt", share: 0.24 },
    ],
  },
  "Incline DB Press": {
    regions: [
      { region: "chest", share: 0.46 },
      { region: "front_delt", share: 0.3 },
      { region: "triceps", share: 0.24 },
    ],
  },
  "Weighted Dip": {
    regions: [
      { region: "chest", share: 0.4 },
      { region: "triceps", share: 0.4 },
      { region: "front_delt", share: 0.2 },
    ],
  },
  "Weighted Pull-up": {
    regions: [
      { region: "lats", share: 0.55 },
      { region: "biceps", share: 0.25 },
      { region: "upper_back", share: 0.15 },
      { region: "rear_delt", share: 0.05 },
    ],
  },
  "Seated Cable Row": {
    // Upper-back focused: grip + pull path to the mid-back drives rhomboids /
    // mid-traps; lats assist. (Vertical pulls remain lats-primary.)
    regions: [
      { region: "upper_back", share: 0.45 },
      { region: "lats", share: 0.3 },
      { region: "biceps", share: 0.17 },
      { region: "rear_delt", share: 0.08 },
    ],
  },
  "Chest-Supported Smith Row": {
    regions: [
      { region: "upper_back", share: 0.45 },
      { region: "lats", share: 0.3 },
      { region: "biceps", share: 0.18 },
      { region: "rear_delt", share: 0.07 },
    ],
  },
  "Cable Lat Pullover": {
    regions: [
      { region: "lats", share: 0.85 },
      { region: "core", share: 0.15 },
    ],
  },
  "One-Arm Lat Pulldown": {
    regions: [
      { region: "lats", share: 0.66 },
      { region: "biceps", share: 0.24 },
      { region: "upper_back", share: 0.05 },
      { region: "rear_delt", share: 0.05 },
    ],
  },
  "Cable Face Pull": {
    regions: [
      { region: "rear_delt", share: 0.5 },
      { region: "upper_back", share: 0.3 },
      { region: "traps", share: 0.1 },
      { region: "biceps", share: 0.1 },
    ],
  },
  "Reverse Pec Deck": {
    regions: [
      { region: "rear_delt", share: 0.8 },
      { region: "upper_back", share: 0.2 },
    ],
  },
  "Cable Lateral Raise": {
    regions: [{ region: "side_delt", share: 1 }],
  },
  "Overhead Press": {
    regions: [
      { region: "front_delt", share: 0.45 },
      { region: "triceps", share: 0.26 },
      { region: "side_delt", share: 0.12 },
      { region: "core", share: 0.1 },
      { region: "traps", share: 0.07 },
    ],
  },
  "Hammer Curl": {
    regions: [
      { region: "biceps", share: 0.85 },
      { region: "core", share: 0.15 },
    ],
  },
  "Incline DB Curl": {
    regions: [
      { region: "biceps", share: 0.88 },
      { region: "core", share: 0.12 },
    ],
  },
  "Preacher Curl": {
    regions: [
      { region: "biceps", share: 0.9 },
      { region: "core", share: 0.1 },
    ],
  },
  "Overhead Cable Triceps Extension": {
    regions: [
      { region: "triceps", share: 0.85 },
      { region: "core", share: 0.15 },
    ],
  },
  "Back Squat": {
    regions: [
      { region: "quads", share: 0.42 },
      { region: "glutes", share: 0.24 },
      { region: "core", share: 0.14 },
      { region: "hamstrings", share: 0.12 },
      { region: "calves", share: 0.08 },
    ],
  },
  "Bulgarian Split Squat": {
    regions: [
      { region: "quads", share: 0.42 },
      { region: "glutes", share: 0.3 },
      { region: "hamstrings", share: 0.12 },
      { region: "core", share: 0.1 },
      { region: "calves", share: 0.06 },
    ],
  },
  "Hack Squat": {
    regions: [
      { region: "quads", share: 0.58 },
      { region: "glutes", share: 0.2 },
      { region: "core", share: 0.08 },
      { region: "calves", share: 0.08 },
      { region: "hamstrings", share: 0.06 },
    ],
  },
  "Leg Extension": {
    regions: [{ region: "quads", share: 1 }],
  },
  "Romanian Deadlift": {
    regions: [
      { region: "hamstrings", share: 0.44 },
      { region: "glutes", share: 0.28 },
      { region: "core", share: 0.14 },
      { region: "upper_back", share: 0.08 },
      { region: "lats", share: 0.06 },
    ],
  },
  "Seated Leg Curl": {
    regions: [{ region: "hamstrings", share: 1 }],
  },
  "Standing Calf Raise": {
    regions: [
      { region: "calves", share: 0.82 },
      { region: "core", share: 0.1 },
      { region: "hamstrings", share: 0.08 },
    ],
  },
  "Weighted Hanging Leg Raise": {
    regions: [
      { region: "core", share: 0.72 },
      { region: "quads", share: 0.12 },
      { region: "lats", share: 0.1 },
      { region: "front_delt", share: 0.06 },
    ],
  },
  "Ab Wheel Rollout": {
    regions: [
      { region: "core", share: 0.76 },
      { region: "lats", share: 0.12 },
      { region: "front_delt", share: 0.12 },
    ],
  },
  "Weighted Cable Crunch": {
    regions: [{ region: "core", share: 1 }],
  },
};

export function epley(weight: number, reps: number): number {
  const r = Math.min(Math.max(reps, 1), 12);
  return weight * (1 + r / 30);
}

// Map an unknown exercise's stored muscle_group string onto a region, so newly
// added exercises still contribute somewhere sensible.
function fallbackRegion(muscleGroup: string): RegionId {
  const k = muscleGroup.toLowerCase();
  if (k.includes("chest")) return "chest";
  if (k.includes("rear")) return "rear_delt";
  if (k.includes("side") || k.includes("lateral")) return "side_delt";
  if (k.includes("front")) return "front_delt";
  if (k.includes("trap")) return "traps";
  if (k.includes("delt") || k.includes("shoulder")) return "side_delt";
  if (k.includes("lat")) return "lats";
  if (k.includes("back")) return "upper_back";
  if (k.includes("bicep")) return "biceps";
  if (k.includes("tricep")) return "triceps";
  if (k.includes("quad")) return "quads";
  if (k.includes("ham")) return "hamstrings";
  if (k.includes("glute")) return "glutes";
  if (k.includes("calf") || k.includes("calv")) return "calves";
  return "core";
}

function modelFor(set: InsightSet): ExerciseModel {
  return (
    EXERCISE_MODELS[set.exerciseName] ?? {
      regions: [{ region: fallbackRegion(set.muscleGroup), share: 1 }],
    }
  );
}

const WEEK_MS = 7 * 24 * 3_600_000;

/* ------------------------------- Volume ------------------------------- */

export interface RegionVolume {
  region: RegionId;
  label: string;
  group: RegionGroup;
  weeklySets: number; // effective sets (direct=1, indirect=0.5), last 7 days
  weeklyVolumeLb: number; // Σ weight×reps×share, last 7 days
  mev: number;
  mrv: number;
  status: "untrained" | "under" | "optimal" | "over";
}

export function computeVolumeByRegion(
  sets: InsightSet[],
  options: { now?: Date } = {},
): RegionVolume[] {
  const nowMs = (options.now ?? new Date()).getTime();
  const weeklySets = new Map<RegionId, number>();
  const weeklyVolume = new Map<RegionId, number>();

  for (const set of sets) {
    // A hard working set counts regardless of external load (bodyweight work is
    // still a set); warm-ups never count. Tonnage only accrues when loaded.
    if (set.isWarmup || set.reps <= 0) continue;
    const ageMs = nowMs - new Date(set.completedAt).getTime();
    if (ageMs < 0 || ageMs > WEEK_MS) continue;
    const model = modelFor(set);
    const tonnage = set.weight > 0 ? set.weight * set.reps : 0;
    // Count sets the way volume landmarks are defined: the muscle the exercise
    // primarily trains gets a full set (direct = 1.0); meaningfully-involved
    // secondary movers get a fractional set (indirect = 0.5); minor stabilisers
    // don't count toward set volume. (Share is still used for tonnage split.)
    const primary = model.regions.reduce((a, b) => (b.share > a.share ? b : a)).region;
    for (const c of model.regions) {
      const setCredit = c.region === primary ? 1 : c.share >= 0.2 ? 0.5 : 0;
      if (setCredit > 0) {
        weeklySets.set(c.region, (weeklySets.get(c.region) ?? 0) + setCredit);
      }
      weeklyVolume.set(c.region, (weeklyVolume.get(c.region) ?? 0) + tonnage * c.share);
    }
  }

  return REGION_ORDER.map((region) => {
    const sets = Math.round((weeklySets.get(region) ?? 0) * 10) / 10;
    const { mev, mrv } = VOLUME_LANDMARKS[region];
    const status: RegionVolume["status"] =
      sets <= 0 ? "untrained" : sets < mev ? "under" : sets > mrv ? "over" : "optimal";
    return {
      region,
      label: REGION_LABELS[region],
      group: REGION_GROUP[region],
      weeklySets: sets,
      weeklyVolumeLb: Math.round(weeklyVolume.get(region) ?? 0),
      mev,
      mrv,
      status,
    };
  });
}

/* ------------------------------ Strength ------------------------------ */

export type LiftName = "bench_press" | "back_squat" | "deadlift" | "overhead_press";

export type StrengthLevel =
  | "Beginner"
  | "Novice"
  | "Intermediate"
  | "Advanced"
  | "Elite";

interface StrengthGroupDef {
  key: string;
  label: string;
  // Tracked lift whose entered 1RM seeds the estimate (if any).
  liftName: LiftName | null;
  // Logged exercises that count as benchmark attempts for this group.
  exercises: string[];
  // Bodyweight-relative load that defines the "Intermediate" threshold (100%).
  standardRatio: number;
  // Pull-ups etc.: the logged weight is *added* load, so total = bodyweight + load.
  bodyweightAdded: boolean;
  hint: string;
}

const STRENGTH_GROUPS: StrengthGroupDef[] = [
  {
    key: "bench",
    label: "Bench Press",
    liftName: "bench_press",
    exercises: ["Bench Press", "Bench Press 1RM Test"],
    standardRatio: 1.0,
    bodyweightAdded: false,
    hint: "Set your bench 1RM in Lifts",
  },
  {
    key: "squat",
    label: "Back Squat",
    liftName: "back_squat",
    exercises: ["Back Squat"],
    standardRatio: 1.35,
    bodyweightAdded: false,
    hint: "Set your squat 1RM in Lifts",
  },
  {
    // Graded against the dumbbell shoulder-press standard (per-dumbbell), since
    // that's how the program's overhead pressing is logged (weight = one
    // dumbbell). StrengthLevel DB shoulder press, 175 lb male: Intermediate
    // ≈ 0.40× bodyweight per dumbbell. A barbell-OHP standard (~0.6×) would
    // wrongly read a normal DB press as "novice".
    key: "ohp",
    label: "Overhead Press",
    liftName: "overhead_press",
    exercises: ["Overhead Press", "Seated DB Press", "Arnold Press", "Machine Shoulder Press"],
    standardRatio: 0.4,
    bodyweightAdded: false,
    hint: "Log a shoulder press",
  },
  {
    key: "deadlift",
    label: "Deadlift",
    liftName: "deadlift",
    exercises: [],
    standardRatio: 1.65,
    bodyweightAdded: false,
    hint: "Set your deadlift 1RM in Lifts",
  },
  {
    key: "pullup",
    label: "Weighted Pull-up",
    liftName: null,
    exercises: ["Weighted Pull-up"],
    standardRatio: 1.25, // total system load (bodyweight + added) at Intermediate
    bodyweightAdded: true,
    hint: "Log a weighted pull-up",
  },
];

export interface StrengthGroupResult {
  key: string;
  label: string;
  score: number | null; // % of the bodyweight-scaled standard
  level: StrengthLevel | null;
  e1rm: number | null;
  standard: number | null;
  source: "1rm" | "logged" | null;
  hint: string;
}

function ageFactor(age: number | null): number {
  if (!age || age < 35) return 1;
  if (age < 45) return 0.96;
  if (age < 55) return 0.88;
  if (age < 65) return 0.76;
  return 0.64;
}

// Uniform level bands relative to each lift's Intermediate threshold (100%).
// Roughly tracks StrengthLevel's beginner→elite spacing across the big lifts.
function levelFor(score: number): StrengthLevel {
  if (score < 70) return "Beginner";
  if (score < 100) return "Novice";
  if (score < 135) return "Intermediate";
  if (score < 175) return "Advanced";
  return "Elite";
}

export function computeStrength(
  sets: InsightSet[],
  options: {
    lifts: Partial<Record<LiftName, number | null>>;
    bodyWeightLb: number | null;
    age: number | null;
  },
): StrengthGroupResult[] {
  const bodyWeight = Math.max(70, options.bodyWeightLb ?? 185);
  const ageAdj = ageFactor(options.age);

  // Working sets are usually submaximal (RIR 1-2), so fold reps-in-reserve into
  // the rep count before the Epley estimate — otherwise an accessory taken to
  // RIR 2 reads ~7% weaker than the lifter actually is.
  const effReps = (set: InsightSet) =>
    set.reps + Math.max(0, Math.min(5, set.rir ?? 0));

  // Best logged e1RM per benchmark exercise (weight = stored loaded weight).
  const bestLoggedByExercise = new Map<string, number>();
  // For bodyweight-added groups (pull-ups) we need TOTAL-load e1RM, so
  // bodyweight is folded into each set rather than post-hoc.
  const bestTotalByExercise = new Map<string, number>();
  for (const set of sets) {
    if (set.isWarmup || set.reps <= 0) continue;
    const reps = effReps(set);
    const loaded = epley(set.weight, reps);
    if (loaded > (bestLoggedByExercise.get(set.exerciseName) ?? 0)) {
      bestLoggedByExercise.set(set.exerciseName, loaded);
    }
    const total = epley(bodyWeight + set.weight, reps);
    if (total > (bestTotalByExercise.get(set.exerciseName) ?? 0)) {
      bestTotalByExercise.set(set.exerciseName, total);
    }
  }

  return STRENGTH_GROUPS.map((g) => {
    const standard = Math.max(1, bodyWeight * g.standardRatio * ageAdj);

    let e1rm: number | null = null;
    let source: "1rm" | "logged" | null = null;

    // 1) Entered 1RM (most authoritative) — only for non-bodyweight lifts.
    if (!g.bodyweightAdded && g.liftName) {
      const oneRm = options.lifts[g.liftName];
      if (oneRm != null && oneRm > 0) {
        e1rm = oneRm;
        source = "1rm";
      }
    }

    // 2) Best logged benchmark set (folds bodyweight in for bw-added groups).
    for (const ex of g.exercises) {
      const logged = g.bodyweightAdded
        ? bestTotalByExercise.get(ex)
        : bestLoggedByExercise.get(ex);
      if (logged != null && logged > 0 && (e1rm == null || logged > e1rm)) {
        e1rm = logged;
        source = source === "1rm" && (options.lifts[g.liftName as LiftName] ?? 0) >= logged ? "1rm" : "logged";
      }
    }

    if (e1rm == null) {
      return {
        key: g.key,
        label: g.label,
        score: null,
        level: null,
        e1rm: null,
        standard: Math.round(standard),
        source: null,
        hint: g.hint,
      };
    }

    const score = Math.round((e1rm / standard) * 100);
    return {
      key: g.key,
      label: g.label,
      score,
      level: levelFor(score),
      e1rm: Math.round(e1rm),
      standard: Math.round(standard),
      source,
      hint: g.hint,
    };
  });
}
