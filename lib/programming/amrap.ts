import type { Units } from "./training-max";

export interface AmrapBumpResult {
  newTm: number;
  bumpAmount: number;
  reason: string;
}

export interface AmrapBumpOptions {
  units?: Units;
  amrapPercentage?: number;
}

export interface AmrapBumpThresholds {
  borderline: number;
  bumpMin: number;
  standardMax: number;
  aggressiveMin: number;
}

// Rep thresholds shift down as the AMRAP set's intensity goes up:
// at 85% TM most lifters lose ~2 reps vs. 80%, so the bump rules slide with it.
export function getAmrapThresholds(amrapPercentage: number): AmrapBumpThresholds {
  const shift = Math.round((amrapPercentage - 80) / 5) * 2;
  const bumpMin = 9 - shift;
  const standardMax = 11 - shift;
  const aggressiveMin = 12 - shift;
  return { borderline: bumpMin - 1, bumpMin, standardMax, aggressiveMin };
}

function bumpAmountFor(units: Units): { standard: number; aggressive: number } {
  return units === "kg" ? { standard: 2.5, aggressive: 5 } : { standard: 5, aggressive: 10 };
}

export function applyAmrapBump(
  currentTm: number,
  amrapReps: number,
  options: AmrapBumpOptions = {},
): AmrapBumpResult {
  const units: Units = options.units ?? "lb";
  const amrapPercentage = options.amrapPercentage ?? 80;
  const { borderline, bumpMin, standardMax, aggressiveMin } = getAmrapThresholds(amrapPercentage);
  const { standard, aggressive } = bumpAmountFor(units);

  if (amrapReps < borderline) {
    return {
      newTm: currentTm,
      bumpAmount: 0,
      reason: `Hold TM (AMRAP under ${borderline} reps at ${amrapPercentage}% TM)`,
    };
  }
  if (amrapReps === borderline) {
    return {
      newTm: currentTm,
      bumpAmount: 0,
      reason: `Hold TM (AMRAP at ${borderline} — borderline, holding for safety)`,
    };
  }
  if (amrapReps <= standardMax) {
    return {
      newTm: currentTm + standard,
      bumpAmount: standard,
      reason: `Standard +${standard} ${units} (${bumpMin}–${standardMax} AMRAP reps at ${amrapPercentage}% TM)`,
    };
  }
  return {
    newTm: currentTm + aggressive,
    bumpAmount: aggressive,
    reason: `Aggressive +${aggressive} ${units} (${aggressiveMin}+ AMRAP reps at ${amrapPercentage}% TM)`,
  };
}

export interface AmrapTmProjection {
  repsLabel: string;
  reps: number;
  result: AmrapBumpResult;
}

// What each AMRAP rep bracket would do to the training max, so a lifter can
// see the outcomes before the set rather than after.
export function amrapTmProjections(
  currentTm: number,
  options: AmrapBumpOptions = {},
): AmrapTmProjection[] {
  const amrapPercentage = options.amrapPercentage ?? 80;
  const { borderline, bumpMin, standardMax, aggressiveMin } = getAmrapThresholds(amrapPercentage);
  // Sample one rep below the borderline so the displayed reason matches the
  // "≤ N" label (the borderline-N case has its own dedicated reason).
  const holdSample = Math.max(0, borderline - 1);
  const standardSample = bumpMin + 1 <= standardMax ? bumpMin + 1 : bumpMin;
  return [
    { repsLabel: `≤ ${borderline}`, reps: holdSample },
    { repsLabel: `${bumpMin}–${standardMax}`, reps: standardSample },
    { repsLabel: `${aggressiveMin}+`, reps: aggressiveMin },
  ].map(({ repsLabel, reps }) => ({
    repsLabel,
    reps,
    result: applyAmrapBump(currentTm, reps, options),
  }));
}
