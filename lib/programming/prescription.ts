import { getCurrentBlock } from "./blocks";

export type BenchDay = "mon" | "wed" | "fri";

export interface PrescribedSet {
  percentage: number;
  sets: number;
  reps: number;
  isAmrap: boolean;
  waveStep?: number;
}

interface BenchTable {
  mon: PrescribedSet[];
  wed: PrescribedSet[];
  fri: PrescribedSet[];
}

const BLOCK_WEEK_TABLE: Record<1 | 2 | 3 | 4, BenchTable> = {
  1: {
    mon: [{ percentage: 75, sets: 5, reps: 5, isAmrap: false }],
    wed: [
      { percentage: 50, sets: 1, reps: 8, isAmrap: false, waveStep: 1 },
      { percentage: 60, sets: 1, reps: 6, isAmrap: false, waveStep: 2 },
      { percentage: 70, sets: 2, reps: 4, isAmrap: false, waveStep: 3 },
      { percentage: 80, sets: 2, reps: 3, isAmrap: false, waveStep: 4 },
    ],
    fri: [{ percentage: 80, sets: 1, reps: 1, isAmrap: true }],
  },
  2: {
    mon: [
      { percentage: 80, sets: 3, reps: 4, isAmrap: false },
      { percentage: 75, sets: 6, reps: 3, isAmrap: false },
    ],
    wed: [
      { percentage: 50, sets: 1, reps: 8, isAmrap: false, waveStep: 1 },
      { percentage: 60, sets: 2, reps: 6, isAmrap: false, waveStep: 2 },
      { percentage: 70, sets: 2, reps: 5, isAmrap: false, waveStep: 3 },
      { percentage: 75, sets: 2, reps: 4, isAmrap: false, waveStep: 4 },
      { percentage: 80, sets: 3, reps: 3, isAmrap: false, waveStep: 5 },
    ],
    fri: [{ percentage: 80, sets: 1, reps: 1, isAmrap: true }],
  },
  3: {
    mon: [
      { percentage: 85, sets: 4, reps: 3, isAmrap: false },
      { percentage: 75, sets: 8, reps: 3, isAmrap: false },
    ],
    wed: [
      { percentage: 50, sets: 1, reps: 8, isAmrap: false, waveStep: 1 },
      { percentage: 60, sets: 2, reps: 6, isAmrap: false, waveStep: 2 },
      { percentage: 70, sets: 2, reps: 5, isAmrap: false, waveStep: 3 },
      { percentage: 80, sets: 2, reps: 3, isAmrap: false, waveStep: 4 },
      { percentage: 90, sets: 2, reps: 1, isAmrap: false, waveStep: 5 },
    ],
    fri: [{ percentage: 80, sets: 1, reps: 1, isAmrap: true }],
  },
  4: {
    mon: [
      { percentage: 80, sets: 2, reps: 3, isAmrap: false },
      { percentage: 75, sets: 5, reps: 3, isAmrap: false },
    ],
    wed: [
      { percentage: 50, sets: 1, reps: 5, isAmrap: false, waveStep: 1 },
      { percentage: 60, sets: 1, reps: 4, isAmrap: false, waveStep: 2 },
      { percentage: 70, sets: 1, reps: 3, isAmrap: false, waveStep: 3 },
      { percentage: 75, sets: 1, reps: 3, isAmrap: false, waveStep: 4 },
      { percentage: 80, sets: 1, reps: 2, isAmrap: false, waveStep: 5 },
    ],
    fri: [{ percentage: 85, sets: 1, reps: 1, isAmrap: true }],
  },
};

const DELOAD_TABLE: BenchTable = {
  mon: [{ percentage: 60, sets: 5, reps: 3, isAmrap: false }],
  wed: [],
  fri: [{ percentage: 70, sets: 3, reps: 3, isAmrap: false }],
};

const TEST_TABLE: BenchTable = {
  mon: [{ percentage: 70, sets: 3, reps: 3, isAmrap: false }],
  wed: [
    { percentage: 50, sets: 1, reps: 5, isAmrap: false, waveStep: 1 },
    { percentage: 70, sets: 1, reps: 3, isAmrap: false, waveStep: 2 },
    { percentage: 80, sets: 1, reps: 1, isAmrap: false, waveStep: 3 },
    { percentage: 90, sets: 1, reps: 1, isAmrap: false, waveStep: 4 },
    { percentage: 95, sets: 1, reps: 1, isAmrap: false, waveStep: 5 },
    { percentage: 100, sets: 1, reps: 1, isAmrap: false, waveStep: 6 },
  ],
  fri: [],
};

export function getBenchPrescriptionForDay(
  weekInBlock: 1 | 2 | 3 | 4,
  day: BenchDay,
): PrescribedSet[] {
  return BLOCK_WEEK_TABLE[weekInBlock][day];
}

export function getBenchPrescriptionForWeek(weekNumber: number, day: BenchDay): PrescribedSet[] {
  const block = getCurrentBlock(weekNumber);
  if (block === "deload") return DELOAD_TABLE[day];
  if (block === "test") return TEST_TABLE[day];
  const weekInBlock = (((weekNumber - 1) % 4) + 1) as 1 | 2 | 3 | 4;
  return getBenchPrescriptionForDay(weekInBlock, day);
}
