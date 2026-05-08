// Pure function: builds the 14-week program structure as plain data.
// No DB calls. Caller persists.

import { getBenchPrescriptionForWeek } from "./prescription";

export type SessionType =
  | "upper_a"
  | "lower_a"
  | "upper_b"
  | "upper_c"
  | "lower_b"
  | "rest"
  | "deload"
  | "test";

export interface PlannedDay {
  weekNumber: number;
  dayOfWeek: number; // 1=Mon, 7=Sun
  sessionType: SessionType;
  displayName: string;
  exercises: PlannedExercise[];
}

export interface PlannedExercise {
  orderIndex: number;
  exerciseName: string;
  prescriptionType: "percentage_tm" | "fixed_load" | "rir_target" | "amrap";
  sets: number;
  reps: number;
  percentageOfTm: number | null;
  rirTarget: number | null;
  isAmrapTopSet: boolean;
  notes: string | null;
  liftName: "bench_press" | "back_squat" | "deadlift" | "overhead_press" | null;
  wavePlan: Array<{ percentage: number; sets: number; reps: number; isAmrap?: boolean; waveStep?: number }> | null;
}

const ACCESSORY = {
  upper_a: [
    { name: "Weighted Pull-up", muscle: "back", sets: 3, reps: 7, rir: 2, notes: "Or lat pulldown" },
    { name: "Seated Cable Row", muscle: "back", sets: 2, reps: 11, rir: 1, notes: "Chest-supported" },
    { name: "Incline DB Press", muscle: "chest", sets: 2, reps: 9, rir: 1, notes: "~30°. Chaves 2020." },
    { name: "Hammer Curl", muscle: "biceps", sets: 2, reps: 11, rir: 1, notes: null },
    { name: "Cable Face Pull", muscle: "rear-delts", sets: 2, reps: 13, rir: 1, notes: null },
  ],
  lower_a: [
    { name: "Back Squat", muscle: "quads", sets: 4, reps: 5, rir: 2, notes: "75% 1RM linear progression", isMain: true, lift: "back_squat" as const },
    { name: "Bulgarian Split Squat", muscle: "quads", sets: 2, reps: 9, rir: 1, notes: "Each leg" },
    { name: "Seated Leg Curl", muscle: "hamstrings", sets: 2, reps: 11, rir: 1, notes: "Maeo 2021." },
    { name: "Standing Calf Raise", muscle: "calves", sets: 3, reps: 10, rir: 1, notes: "Deep stretch, pause. Kassiano 2023." },
    { name: "Hanging Leg Raise", muscle: "abs", sets: 2, reps: 13, rir: 1, notes: null },
  ],
  upper_b: [
    { name: "Chest-Supported T-Bar Row", muscle: "back", sets: 3, reps: 9, rir: 1, notes: null },
    { name: "Incline DB Bench", muscle: "chest", sets: 2, reps: 11, rir: 1, notes: "~30°" },
    { name: "One-Arm Lat Pulldown", muscle: "back", sets: 2, reps: 11, rir: 1, notes: "Kneeling" },
    { name: "Cable Lateral Raise", muscle: "side-delts", sets: 3, reps: 12, rir: 1, notes: "Lean-away" },
    { name: "Cable Triceps Pushdown", muscle: "triceps", sets: 2, reps: 13, rir: 0, notes: "Rope" },
  ],
  upper_c: [
    { name: "Close-Grip Bench Press", muscle: "triceps", sets: 2, reps: 7, rir: 2, notes: null },
    { name: "Weighted Dip", muscle: "chest", sets: 2, reps: 9, rir: 1, notes: "Or machine chest press" },
    { name: "Overhead Cable Triceps Extension", muscle: "triceps", sets: 3, reps: 11, rir: 1, notes: "Rope. Maeo 2023 long head." },
    { name: "Incline DB Curl", muscle: "biceps", sets: 2, reps: 11, rir: 1, notes: null },
    { name: "Cable Lateral Raise", muscle: "side-delts", sets: 2, reps: 13, rir: 0, notes: null },
  ],
  lower_b: [
    { name: "Romanian Deadlift", muscle: "hamstrings", sets: 3, reps: 7, rir: 2, notes: null, isMain: true, lift: "deadlift" as const },
    { name: "Hack Squat", muscle: "quads", sets: 2, reps: 9, rir: 1, notes: "Or leg press" },
    { name: "Leg Extension", muscle: "quads", sets: 2, reps: 11, rir: 1, notes: "Paused at top, lengthened ROM. Pedrosa 2022." },
    { name: "Seated Leg Curl", muscle: "hamstrings", sets: 2, reps: 11, rir: 1, notes: null },
    { name: "Seated Calf Raise", muscle: "calves", sets: 3, reps: 12, rir: 1, notes: "Donkey style" },
    { name: "Cable Crunch", muscle: "abs", sets: 2, reps: 12, rir: 1, notes: null },
  ],
};

const DAY_NAMES: Record<SessionType, string> = {
  upper_a: "Upper A — Heavy Bench",
  lower_a: "Lower A — Squat focus",
  upper_b: "Upper B — Volume Bench + Incline",
  upper_c: "Upper C — Bench AMRAP + Arms",
  lower_b: "Lower B — Hinge focus",
  rest: "Rest",
  deload: "Deload",
  test: "Test",
};

const WEEKLY_PATTERN: SessionType[] = [
  "upper_a", // Mon
  "lower_a", // Tue
  "upper_b", // Wed
  "rest", // Thu
  "upper_c", // Fri
  "lower_b", // Sat
  "rest", // Sun
];

function benchExercise(
  weekNumber: number,
  day: "mon" | "wed" | "fri",
): PlannedExercise[] {
  const sets = getBenchPrescriptionForWeek(weekNumber, day);
  if (sets.length === 0) return [];

  // Top "primary" set: largest percentage line (used for the main row)
  const top = sets[0];
  const isAmrap = sets.some((s) => s.isAmrap);
  return [
    {
      orderIndex: 1,
      exerciseName: "Bench Press",
      prescriptionType: isAmrap ? "amrap" : "percentage_tm",
      sets: top.sets,
      reps: top.reps,
      percentageOfTm: top.percentage,
      rirTarget: null,
      isAmrapTopSet: isAmrap,
      notes: null,
      liftName: "bench_press",
      wavePlan: sets.length > 1 || sets[0].isAmrap ? sets : null,
    },
  ];
}

function ohpExercise(weekNumber: number): PlannedExercise[] {
  // OHP appears as accessory on Upper A: 3 × 6, ~70% (linear). Treat as fixed_load placeholder for seed.
  return [
    {
      orderIndex: 99,
      exerciseName: "Overhead Press",
      prescriptionType: "rir_target",
      sets: 3,
      reps: 6,
      percentageOfTm: null,
      rirTarget: 2,
      isAmrapTopSet: false,
      notes: "Strict, no leg drive",
      liftName: "overhead_press",
      wavePlan: null,
    },
  ];
}

function accessoryToPlanned(
  acc: typeof ACCESSORY.upper_a[number],
  startIdx: number,
): PlannedExercise {
  const lift = ("lift" in acc ? (acc as { lift: PlannedExercise["liftName"] }).lift : null) ?? null;
  return {
    orderIndex: startIdx,
    exerciseName: acc.name,
    prescriptionType: "rir_target",
    sets: acc.sets,
    reps: acc.reps,
    percentageOfTm: null,
    rirTarget: acc.rir,
    isAmrapTopSet: false,
    notes: acc.notes,
    liftName: lift ?? null,
    wavePlan: null,
  };
}

export function buildProgramDays(): PlannedDay[] {
  const days: PlannedDay[] = [];

  for (let w = 1; w <= 14; w++) {
    for (let d = 1; d <= 7; d++) {
      let session = WEEKLY_PATTERN[d - 1];
      if (w === 13) {
        // Deload week: same pattern but mark lifting days deload-ish
        if (session === "rest") {
          // keep
        }
      }
      if (w === 14) {
        if (session !== "rest") session = "test";
      }

      if (session === "rest") {
        days.push({
          weekNumber: w,
          dayOfWeek: d,
          sessionType: "rest",
          displayName: DAY_NAMES.rest,
          exercises: [],
        });
        continue;
      }

      const exercises: PlannedExercise[] = [];

      if (session === "upper_a") {
        exercises.push(...benchExercise(w, "mon"));
        ACCESSORY.upper_a.forEach((a, i) => exercises.push(accessoryToPlanned(a, i + 2)));
        exercises.push(...ohpExercise(w));
      } else if (session === "upper_b") {
        exercises.push(...benchExercise(w, "wed"));
        ACCESSORY.upper_b.forEach((a, i) => exercises.push(accessoryToPlanned(a, i + 2)));
      } else if (session === "upper_c") {
        exercises.push(...benchExercise(w, "fri"));
        ACCESSORY.upper_c.forEach((a, i) => exercises.push(accessoryToPlanned(a, i + 2)));
      } else if (session === "lower_a") {
        ACCESSORY.lower_a.forEach((a, i) => exercises.push(accessoryToPlanned(a, i + 1)));
      } else if (session === "lower_b") {
        ACCESSORY.lower_b.forEach((a, i) => exercises.push(accessoryToPlanned(a, i + 1)));
      } else if (session === "test") {
        // Test week sessions
        if (d === 1) {
          exercises.push({
            orderIndex: 1,
            exerciseName: "Bench Press",
            prescriptionType: "percentage_tm",
            sets: 3,
            reps: 3,
            percentageOfTm: 70,
            rirTarget: null,
            isAmrapTopSet: false,
            notes: "Light primer for 1RM test",
            liftName: "bench_press",
            wavePlan: getBenchPrescriptionForWeek(14, "mon"),
          });
        } else if (d === 3) {
          exercises.push({
            orderIndex: 1,
            exerciseName: "Bench Press 1RM Test",
            prescriptionType: "percentage_tm",
            sets: 1,
            reps: 1,
            percentageOfTm: 100,
            rirTarget: null,
            isAmrapTopSet: false,
            notes: "Warmup ladder then attempt",
            liftName: "bench_press",
            wavePlan: getBenchPrescriptionForWeek(14, "wed"),
          });
        }
      }

      days.push({
        weekNumber: w,
        dayOfWeek: d,
        sessionType: w === 13 ? "deload" : w === 14 ? "test" : session,
        displayName: DAY_NAMES[w === 13 ? "deload" : w === 14 ? "test" : session],
        exercises,
      });
    }
  }

  return days;
}

// Distinct exercise list (for seeding the exercises table)
export function buildExerciseLibrary(): Array<{
  name: string;
  muscleGroup: string;
  defaultSets: number;
  isMainLift: boolean;
  notes: string | null;
}> {
  const set = new Map<string, { muscle: string; sets: number; isMain: boolean; notes: string | null }>();
  const add = (name: string, muscle: string, sets: number, isMain: boolean, notes: string | null) => {
    if (!set.has(name)) set.set(name, { muscle, sets, isMain, notes });
  };

  add("Bench Press", "chest", 5, true, null);
  add("Back Squat", "quads", 4, true, null);
  add("Deadlift", "back", 1, true, null);
  add("Overhead Press", "shoulders", 3, true, null);

  for (const group of Object.values(ACCESSORY)) {
    for (const a of group) {
      const isMain = "isMain" in a ? a.isMain : false;
      add(a.name, a.muscle, a.sets, !!isMain, a.notes);
    }
  }
  add("Bench Press 1RM Test", "chest", 1, true, "1RM test attempt");

  return Array.from(set.entries()).map(([name, v]) => ({
    name,
    muscleGroup: v.muscle,
    defaultSets: v.sets,
    isMainLift: v.isMain,
    notes: v.notes,
  }));
}
