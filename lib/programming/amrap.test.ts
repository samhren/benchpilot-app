import { describe, expect, it } from "vitest";
import { applyAmrapBump } from "./amrap";

describe("applyAmrapBump", () => {
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
