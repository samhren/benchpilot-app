import { describe, expect, it } from "vitest";
import { barWeight, calcPlates, platesSummary } from "./plates";

describe("calcPlates (lb, 45 lb bar)", () => {
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
  it("explicit lb units arg matches default", () => {
    expect(calcPlates(215, "lb")).toEqual([45, 25, 10, 5]);
  });
  it("barWeight('lb') = 45", () => expect(barWeight("lb")).toBe(45));
});

describe("calcPlates (kg, 20 kg bar)", () => {
  it("100 kg → 25 + 15 / side", () => {
    expect(calcPlates(100, "kg")).toEqual([25, 15]);
    expect(platesSummary(calcPlates(100, "kg"))).toBe("25 + 15 / side");
  });
  it("20 kg → bar only", () => {
    expect(calcPlates(20, "kg")).toEqual([]);
  });
  it("60 kg → 20", () => expect(calcPlates(60, "kg")).toEqual([20]));
  it("62.5 kg → 20 + 1.25", () => {
    expect(calcPlates(62.5, "kg")).toEqual([20, 1.25]);
    expect(platesSummary(calcPlates(62.5, "kg"))).toBe("20 + 1.25 / side");
  });
  it("barWeight('kg') = 20", () => expect(barWeight("kg")).toBe(20));
});
