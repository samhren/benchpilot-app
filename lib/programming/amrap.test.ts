import { describe, expect, it } from "vitest";
import { applyAmrapBump, amrapTmProjections } from "./amrap";

describe("applyAmrapBump @ 80% (default)", () => {
  const cases: Array<[number, number, number]> = [
    [5, 0, 0],
    [7, 0, 0],
    [8, 0, 0],
    [9, 5, 5],
    [10, 5, 5],
    [11, 5, 5],
    [12, 10, 10],
    [15, 10, 10],
  ];
  it.each(cases)("AMRAP %i → bump %i", (reps, bump) => {
    const r = applyAmrapBump(205, reps);
    expect(r.bumpAmount).toBe(bump);
    expect(r.newTm).toBe(205 + bump);
  });

  it("under 8 mentions hold", () => {
    expect(applyAmrapBump(205, 5).reason).toMatch(/Hold TM/);
  });

  it("exactly 8 has its own borderline reason", () => {
    expect(applyAmrapBump(205, 8).reason).toMatch(/borderline/);
  });

  it("9–11 reason mentions standard +5", () => {
    expect(applyAmrapBump(205, 10).reason).toMatch(/Standard \+5/);
  });

  it("12+ reason mentions aggressive +10", () => {
    expect(applyAmrapBump(205, 12).reason).toMatch(/Aggressive \+10/);
  });
});

describe("applyAmrapBump @ kg units", () => {
  it("9–11 reps → +2.5 kg", () => {
    const r = applyAmrapBump(90, 10, { units: "kg" });
    expect(r.bumpAmount).toBe(2.5);
    expect(r.newTm).toBe(92.5);
    expect(r.reason).toMatch(/\+2\.5 kg/);
  });
  it("12+ reps → +5 kg", () => {
    const r = applyAmrapBump(90, 13, { units: "kg" });
    expect(r.bumpAmount).toBe(5);
    expect(r.newTm).toBe(95);
    expect(r.reason).toMatch(/\+5 kg/);
  });
  it("under 8 reps → hold (kg)", () => {
    const r = applyAmrapBump(90, 5, { units: "kg" });
    expect(r.bumpAmount).toBe(0);
    expect(r.newTm).toBe(90);
  });
});

describe("applyAmrapBump @ 85% (end-of-block) — percentage-aware", () => {
  // At 85% TM, expected reps drop ~2, so thresholds slide down.
  // Formula: shift = round((85 - 80) / 5) * 2 = 2 → hold <7, +5 at 7–9, +10 at 10+.
  const cases: Array<[number, number]> = [
    [5, 0], // hold
    [7, 5], // standard
    [9, 5], // standard
    [11, 10], // aggressive
  ];
  it.each(cases)("AMRAP %i @ 85% → bump %i", (reps, bump) => {
    const r = applyAmrapBump(205, reps, { amrapPercentage: 85 });
    expect(r.bumpAmount).toBe(bump);
  });

  it("reason at 85% mentions the percentage", () => {
    expect(applyAmrapBump(205, 10, { amrapPercentage: 85 }).reason).toMatch(/85% TM/);
  });

  it("85% + kg → +2.5 / +5 kg at the shifted thresholds", () => {
    expect(applyAmrapBump(90, 7, { amrapPercentage: 85, units: "kg" }).bumpAmount).toBe(2.5);
    expect(applyAmrapBump(90, 11, { amrapPercentage: 85, units: "kg" }).bumpAmount).toBe(5);
  });
});

describe("applyAmrapBump @ 80% explicit (sanity)", () => {
  it.each([
    [8, 0],
    [10, 5],
    [12, 10],
  ] as Array<[number, number]>)("AMRAP %i @ 80% → bump %i", (reps, bump) => {
    expect(applyAmrapBump(205, reps, { amrapPercentage: 80 }).bumpAmount).toBe(bump);
  });
});

describe("amrapTmProjections", () => {
  it("≤8 row samples reps that yield a non-borderline hold reason", () => {
    const [holdRow] = amrapTmProjections(205);
    expect(holdRow.repsLabel).toBe("≤ 8");
    expect(holdRow.result.bumpAmount).toBe(0);
    // Must be the "under N" message, not the borderline-8 case.
    expect(holdRow.result.reason).not.toMatch(/borderline/);
  });

  it("labels and samples shift with amrapPercentage", () => {
    const [hold, standard, aggressive] = amrapTmProjections(205, { amrapPercentage: 85 });
    expect(hold.repsLabel).toBe("≤ 6");
    expect(standard.repsLabel).toBe("7–9");
    expect(aggressive.repsLabel).toBe("10+");
    expect(aggressive.result.bumpAmount).toBe(10);
  });
});
