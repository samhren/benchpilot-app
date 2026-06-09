import { describe, expect, it } from "vitest";
import {
  estimateSquatE1rm,
  isCleanSquatSession,
  squatSetMeetsPrescription,
} from "./squat-progression";

// Prescription used across the cases: 185 lb × 5 (Epley e1RM ≈ 215.8).
const base = { repsPrescribed: 5, weightPrescribed: 185 };

describe("estimateSquatE1rm", () => {
  it("matches the Epley formula", () => {
    expect(estimateSquatE1rm(185, 5)).toBeCloseTo(215.83, 1);
  });

  it("caps reps at 12 so high-rep sets don't claim an absurd 1RM", () => {
    expect(estimateSquatE1rm(100, 20)).toBe(estimateSquatE1rm(100, 12));
  });
});

describe("squatSetMeetsPrescription", () => {
  it("passes an exact match", () => {
    expect(squatSetMeetsPrescription({ ...base, repsCompleted: 5, weightUsed: 185 })).toBe(true);
  });

  it("passes heavier weight for fewer reps when e1RM is higher", () => {
    // 205×3 (e1RM ≈ 225.5) beats the prescribed 185×5 (e1RM ≈ 215.8).
    expect(squatSetMeetsPrescription({ ...base, repsCompleted: 3, weightUsed: 205 })).toBe(true);
  });

  it("passes more reps at the prescribed weight", () => {
    expect(squatSetMeetsPrescription({ ...base, repsCompleted: 7, weightUsed: 185 })).toBe(true);
  });

  it("holds when fewer reps at the same weight fall short", () => {
    expect(squatSetMeetsPrescription({ ...base, repsCompleted: 4, weightUsed: 185 })).toBe(false);
  });

  it("requires a lighter weight to truly make up the reps", () => {
    // 175×5 (e1RM ≈ 204) falls short; 175×7 (e1RM ≈ 215.8) catches up.
    expect(squatSetMeetsPrescription({ ...base, repsCompleted: 5, weightUsed: 175 })).toBe(false);
    expect(squatSetMeetsPrescription({ ...base, repsCompleted: 7, weightUsed: 175 })).toBe(true);
  });

  it("fails on missing or non-positive data", () => {
    expect(squatSetMeetsPrescription({ ...base, repsCompleted: null, weightUsed: 185 })).toBe(false);
    expect(squatSetMeetsPrescription({ ...base, repsCompleted: 5, weightUsed: null })).toBe(false);
    expect(squatSetMeetsPrescription({ ...base, repsCompleted: 0, weightUsed: 185 })).toBe(false);
    expect(squatSetMeetsPrescription({ ...base, repsCompleted: 5, weightUsed: 0 })).toBe(false);
  });
});

describe("isCleanSquatSession", () => {
  it("moves you up when all four sets hit the prescribed weight and reps", () => {
    const prescribed = { ...base, repsCompleted: 5, weightUsed: 185 };
    expect(isCleanSquatSession([prescribed, prescribed, prescribed, prescribed])).toBe(true);
  });

  it("is clean when every set meets the prescription", () => {
    expect(
      isCleanSquatSession([
        { ...base, repsCompleted: 5, weightUsed: 185 },
        { ...base, repsCompleted: 3, weightUsed: 205 }, // heavier, fewer reps — still counts
        { ...base, repsCompleted: 5, weightUsed: 185 },
        { ...base, repsCompleted: 6, weightUsed: 185 },
      ]),
    ).toBe(true);
  });

  it("holds if any set falls short", () => {
    expect(
      isCleanSquatSession([
        { ...base, repsCompleted: 5, weightUsed: 185 },
        { ...base, repsCompleted: 4, weightUsed: 185 },
      ]),
    ).toBe(false);
  });

  it("never bumps when the squat wasn't trained", () => {
    expect(isCleanSquatSession([])).toBe(false);
  });
});
