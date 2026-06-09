// Squat linear-progression gating — pure, framework-agnostic. No Drizzle / no
// React here, so every function is unit-testable (see squat-progression.test.ts).
//
// The squat runs a simple linear block: meet the prescribed work, add weight the
// next time. The question this module answers is "did the lifter actually meet
// the prescription?" — and it answers by estimated 1RM rather than a rigid
// reps-AND-weight match. That way a heavier load for fewer reps (e.g. 205×3 in
// place of 185×5) still counts as meeting the day's work, which is how strength
// actually expresses itself.

export interface SquatSetPerformance {
  repsPrescribed: number | null;
  repsCompleted: number | null;
  weightPrescribed: number | null;
  weightUsed: number | null;
}

// Epley estimate, capped at 12 reps to match lib/lift-stats.epleyE1rm — past ~12
// the formula drifts badly and a high-rep set shouldn't claim an absurd 1RM.
export function estimateSquatE1rm(weight: number, reps: number): number {
  const r = Math.min(Math.max(reps, 1), 12);
  return weight * (1 + r / 30);
}

// A set meets its prescription when the estimated 1RM of what was performed is at
// least the estimated 1RM the prescription called for. This is intentionally
// looser than the old "all reps AND at-least-prescribed weight AND RIR ≥ 1":
//   - going heavier for fewer reps clears the bar (205×3 beats 185×5),
//   - a lighter set only counts if the extra reps genuinely make up the gap,
//   - falling short on reps at the same weight still holds the weight.
export function squatSetMeetsPrescription(set: SquatSetPerformance): boolean {
  const { repsPrescribed, repsCompleted, weightPrescribed, weightUsed } = set;
  if (repsPrescribed == null || repsCompleted == null) return false;
  if (weightPrescribed == null || weightUsed == null) return false;
  if (weightUsed <= 0 || repsCompleted <= 0) return false;
  const performed = estimateSquatE1rm(weightUsed, repsCompleted);
  const target = estimateSquatE1rm(weightPrescribed, repsPrescribed);
  // Epsilon so an exact-match set isn't lost to floating-point rounding.
  return performed + 1e-6 >= target;
}

// Linear progression advances only when every working set met or beat its
// prescription — one short set holds the weight for another go. An empty list
// (squat wasn't trained this session) never triggers a bump.
export function isCleanSquatSession(sets: SquatSetPerformance[]): boolean {
  if (sets.length === 0) return false;
  return sets.every(squatSetMeetsPrescription);
}
