import type { Tempo } from "@/lib/programming/tempo";

export interface SetRow {
  kind: "main" | "accessory";
  isMainLift: boolean;
  sessionExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  totalSets: number;
  repsPrescribed: number;
  weightPrescribed: number | null;
  percentage: number | null;
  isAmrap: boolean;
  rirTarget: number | null;
  sessionLabel: string;
  tempo: Tempo;
  equipment: string | null;
  requiresWeightInput: boolean;
  // Weight is programmed (a working-weight prescription) but the lifter is meant
  // to set the actual load each session — the squat's linear progression. Unlike
  // bench (TM-driven, fixed), these rows surface an editable weight stepper.
  weightEditable: boolean;
  last: { reps: number; weight: number } | null;
  lastSession: {
    date: number;
    sets: Array<{ setNumber: number; reps: number; weight: number }>;
  } | null;
  logged: {
    id: string;
    repsCompleted: number;
    weightUsed: number;
    rir: number | null;
  } | null;
}

export interface SessionExerciseEntry {
  id: string;
  exerciseId: string;
  name: string;
  muscleGroup: string;
  orderIndex: number;
  status: "pending" | "completed" | "skipped" | "partial";
  swappedFromExerciseId: string | null;
  isMainLift: boolean;
  notes: string | null;
}

export type BufferedSet = {
  repsCompleted: number;
  weightUsed: number;
  rir: number | null;
};

export type PendingBump = {
  liftName: "bench_press";
  amrapReps: number;
  amrapPercentage: number;
  applied: boolean | null;
};
