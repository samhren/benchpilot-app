import { describe, expect, it } from "vitest";
import { getBenchPrescriptionForDay, getBenchPrescriptionForWeek } from "./prescription";

describe("getBenchPrescriptionForDay - all (weekInBlock, day) combos", () => {
  for (const wk of [1, 2, 3, 4] as const) {
    for (const day of ["mon", "wed", "fri"] as const) {
      it(`returns sets for wk ${wk} ${day}`, () => {
        const sets = getBenchPrescriptionForDay(wk, day);
        expect(Array.isArray(sets)).toBe(true);
        expect(sets.length).toBeGreaterThan(0);
        for (const s of sets) {
          expect(s.percentage).toBeGreaterThan(0);
          expect(s.percentage).toBeLessThanOrEqual(100);
          expect(s.sets).toBeGreaterThan(0);
          expect(s.reps).toBeGreaterThan(0);
        }
      });
    }
  }

  it("wk1 mon = 5x5 @ 75%", () => {
    expect(getBenchPrescriptionForDay(1, "mon")).toEqual([
      { percentage: 75, sets: 5, reps: 5, isAmrap: false },
    ]);
  });

  it("wk1 fri is AMRAP at 80%", () => {
    const sets = getBenchPrescriptionForDay(1, "fri");
    expect(sets[0].isAmrap).toBe(true);
    expect(sets[0].percentage).toBe(80);
  });

  it("wk4 fri is AMRAP at 85% (deload top)", () => {
    const sets = getBenchPrescriptionForDay(4, "fri");
    expect(sets[0].isAmrap).toBe(true);
    expect(sets[0].percentage).toBe(85);
  });
});

describe("getBenchPrescriptionForWeek by absolute week", () => {
  it("week 1 mon == block-week 1 mon", () => {
    expect(getBenchPrescriptionForWeek(1, "mon")).toEqual(
      getBenchPrescriptionForDay(1, "mon"),
    );
  });
  it("week 5 mon == block-week 1 mon (block 2)", () => {
    expect(getBenchPrescriptionForWeek(5, "mon")).toEqual(
      getBenchPrescriptionForDay(1, "mon"),
    );
  });
  it("week 13 (deload) mon = 60% × 5×3", () => {
    expect(getBenchPrescriptionForWeek(13, "mon")).toEqual([
      { percentage: 60, sets: 5, reps: 3, isAmrap: false },
    ]);
  });
  it("week 13 wed = []", () => {
    expect(getBenchPrescriptionForWeek(13, "wed")).toEqual([]);
  });
  it("week 14 (test) wed includes 100% attempt", () => {
    const wed = getBenchPrescriptionForWeek(14, "wed");
    expect(wed.some((s) => s.percentage === 100)).toBe(true);
  });
});
