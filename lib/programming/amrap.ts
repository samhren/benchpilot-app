export interface AmrapBumpResult {
  newTm: number;
  bumpAmount: number;
  reason: string;
}

export function applyAmrapBump(currentTm: number, amrapReps: number): AmrapBumpResult {
  if (amrapReps < 8) {
    return { newTm: currentTm, bumpAmount: 0, reason: "Hold TM (AMRAP under 8 reps)" };
  }
  if (amrapReps === 8) {
    return {
      newTm: currentTm,
      bumpAmount: 0,
      reason: "Hold TM (AMRAP at 8 — borderline, holding for safety)",
    };
  }
  if (amrapReps >= 9 && amrapReps <= 11) {
    return {
      newTm: currentTm + 5,
      bumpAmount: 5,
      reason: "Standard +5 lb (9–11 AMRAP reps)",
    };
  }
  return {
    newTm: currentTm + 10,
    bumpAmount: 10,
    reason: "Aggressive +10 lb (12+ AMRAP reps)",
  };
}

export interface AmrapTmProjection {
  repsLabel: string;
  reps: number;
  result: AmrapBumpResult;
}

// What each AMRAP rep bracket would do to the training max, so a lifter can
// see the outcomes before the set rather than after.
export function amrapTmProjections(currentTm: number): AmrapTmProjection[] {
  return [
    { repsLabel: "≤ 8", reps: 8 },
    { repsLabel: "9–11", reps: 10 },
    { repsLabel: "12+", reps: 12 },
  ].map(({ repsLabel, reps }) => ({
    repsLabel,
    reps,
    result: applyAmrapBump(currentTm, reps),
  }));
}
