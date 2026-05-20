import { describe, expect, it } from "vitest";
import { buildProgramDays } from "./seed-program";

describe("buildProgramDays — bench wave top-set selection", () => {
  const days = buildProgramDays();

  function bench(week: number, day: number) {
    const d = days.find((x) => x.weekNumber === week && x.dayOfWeek === day);
    if (!d) throw new Error(`No day for wk ${week} d ${day}`);
    const b = d.exercises.find((e) => e.exerciseName === "Bench Press");
    if (!b) throw new Error(`No bench on wk ${week} d ${day}`);
    return b;
  }

  it("Wk1 Wed bench top set is 80% × 3 reps × 2 sets (heaviest line in the wave)", () => {
    // Block 1 Wed wave: 50%×8, 60%×6, 70%×4×2, 80%×3×2.
    // sets[0] would be 50% (the bug); reducer must pick 80%.
    const b = bench(1, 3);
    expect(b.percentageOfTm).toBe(80);
    expect(b.reps).toBe(3);
    expect(b.sets).toBe(2);
  });

  it("Wk3 Wed bench top set is 90% × 1 × 2 (block 1 wk3)", () => {
    const b = bench(3, 3);
    expect(b.percentageOfTm).toBe(90);
    expect(b.reps).toBe(1);
    expect(b.sets).toBe(2);
  });

  it("Wk1 Mon bench is the single 75% × 5×5 row (top trivially unchanged)", () => {
    const b = bench(1, 1);
    expect(b.percentageOfTm).toBe(75);
    expect(b.sets).toBe(5);
    expect(b.reps).toBe(5);
  });

  it("Wk1 Fri bench is the AMRAP 80% × 1 (top trivially unchanged)", () => {
    const b = bench(1, 5);
    expect(b.percentageOfTm).toBe(80);
    expect(b.isAmrapTopSet).toBe(true);
  });

  it("Wk2 Mon bench top is 80% (heavier of the two sequential lines)", () => {
    // Block 1 Wk2 Mon: 80%×4×3 then 75%×3×6 — top is the 80% set.
    const b = bench(2, 1);
    expect(b.percentageOfTm).toBe(80);
  });
});
