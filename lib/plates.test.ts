import { describe, expect, it } from "vitest";
import { calcPlates, platesSummary } from "./plates";

describe("calcPlates (45 lb bar)", () => {
  it("215 → 45 + 25 + 10 + 5 / side", () => {
    expect(calcPlates(215)).toEqual([45, 25, 10, 5]);
    expect(platesSummary(calcPlates(215))).toBe("45 + 25 + 10 + 5 / side");
  });
  it("135 → 45", () => expect(calcPlates(135)).toEqual([45]));
  it("45 → bar only", () => {
    expect(calcPlates(45)).toEqual([]);
    expect(platesSummary([])).toBe("Bar only");
  });
  it("100 → 25 + 2.5", () => expect(calcPlates(100)).toEqual([25, 2.5]));
});
