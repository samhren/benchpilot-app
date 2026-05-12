export type RestCategory = "amrap" | "heavy" | "moderate" | "isolation";

export const REST_SECONDS: Record<RestCategory, number> = {
  amrap: 240,
  heavy: 180,
  moderate: 120,
  isolation: 90,
};

const MODERATE_NAME_PATTERNS = [
  /romanian/i,
  /\brdl\b/i,
  /bulgarian/i,
  /\bbss\b/i,
  /split squat/i,
  /hack squat/i,
  /front squat/i,
  /goblet squat/i,
  /incline/i,
  /decline bench/i,
  /\bdip\b/i,
  /chin[- ]?up/i,
  /pull[- ]?up/i,
  /pendlay/i,
  /barbell row/i,
  /t[- ]?bar row/i,
  /meadows row/i,
  /hip thrust/i,
  /good morning/i,
  /overhead press/i,
  /push press/i,
  /landmine press/i,
];

export function classifyRestCategory(input: {
  exerciseName: string;
  isMainLift: boolean;
  isAmrap: boolean;
}): RestCategory {
  if (input.isAmrap) return "amrap";
  if (input.isMainLift) return "heavy";
  if (MODERATE_NAME_PATTERNS.some((p) => p.test(input.exerciseName))) return "moderate";
  return "isolation";
}

export function restSecondsFor(input: {
  exerciseName: string;
  isMainLift: boolean;
  isAmrap: boolean;
}): number {
  return REST_SECONDS[classifyRestCategory(input)];
}
