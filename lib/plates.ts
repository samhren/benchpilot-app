import type { Units } from "./programming/training-max";

// Bar + side plates by unit system. 35 lb is intentionally skipped — most US
// lifters reach for 25 + 10 instead. 1.25 kg microplates are common at modern
// kg gyms.
const PLATES_LB = [45, 25, 10, 5, 2.5];
const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];
const BAR_LB = 45;
const BAR_KG = 20;

export function barWeight(units: Units = "lb"): number {
  return units === "kg" ? BAR_KG : BAR_LB;
}

export function calcPlates(weight: number, units: Units = "lb"): number[] {
  const plates = units === "kg" ? PLATES_KG : PLATES_LB;
  const bar = barWeight(units);
  const perSide = (weight - bar) / 2;
  if (perSide <= 0) return [];
  let remaining = perSide;
  const result: number[] = [];
  for (const p of plates) {
    while (remaining >= p - 0.001) {
      result.push(p);
      remaining -= p;
    }
  }
  return result;
}

export function platesSummary(plates: number[]): string {
  if (!plates.length) return "Bar only";
  return plates.map((p) => (p % 1 === 0 ? p.toString() : p.toFixed(2).replace(/0$/, ""))).join(" + ") + " / side";
}
