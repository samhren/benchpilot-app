import { describe, expect, it } from "vitest";
import { resolveBenchPrescription, resolveTrainingMax, roundForUnits } from "./training-max";

describe("resolveTrainingMax", () => {
  it("rounds 225 * 0.9 = 202.5 to 205", () => {
    expect(resolveTrainingMax(225, "lb")).toBe(205);
  });
  it("rounds 245 * 0.9 = 220.5 to 220", () => {
    expect(resolveTrainingMax(245, "lb")).toBe(220);
  });
  it("rounds 285 * 0.9 = 256.5 to 255", () => {
    expect(resolveTrainingMax(285, "lb")).toBe(255);
  });
  it("kg uses 2.5 step", () => {
    expect(resolveTrainingMax(100, "kg")).toBe(90);
    expect(resolveTrainingMax(102, "kg")).toBe(92.5);
  });
});

describe("resolveBenchPrescription", () => {
  it("75% of 285 → 215 (213.75 rounds to 215)", () => {
    expect(resolveBenchPrescription(75, 285, "lb")).toBe(215);
  });
  it("80% of 245 → 195 (196 rounds to 195)", () => {
    expect(resolveBenchPrescription(80, 245, "lb")).toBe(195);
  });
  it("75% of 205 → 155 (153.75 rounds to 155)", () => {
    expect(resolveBenchPrescription(75, 205, "lb")).toBe(155);
  });
  it("80% of 205 → 165 (164 rounds to 165)", () => {
    expect(resolveBenchPrescription(80, 205, "lb")).toBe(165);
  });
  it("kg rounds to 2.5", () => {
    expect(resolveBenchPrescription(75, 100, "kg")).toBe(75);
    expect(resolveBenchPrescription(73, 100, "kg")).toBe(72.5);
  });
});

describe("roundForUnits", () => {
  it("lb: nearest 5", () => {
    expect(roundForUnits(212.4, "lb")).toBe(210);
    expect(roundForUnits(212.5, "lb")).toBe(215);
    expect(roundForUnits(213.75, "lb")).toBe(215);
  });
  it("kg: nearest 2.5", () => {
    expect(roundForUnits(72.49, "kg")).toBe(72.5);
    expect(roundForUnits(73.75, "kg")).toBe(75);
  });
});
