export type Units = "lb" | "kg";

const roundToNearest = (value: number, step: number): number =>
  Math.round(value / step) * step;

export const roundForUnits = (value: number, units: Units): number =>
  units === "kg" ? roundToNearest(value, 2.5) : roundToNearest(value, 5);

export function resolveTrainingMax(currentOneRm: number, units: Units = "lb"): number {
  return roundForUnits(currentOneRm * 0.9, units);
}

export function resolveBenchPrescription(
  percentage: number,
  trainingMax: number,
  units: Units = "lb",
): number {
  return roundForUnits((percentage / 100) * trainingMax, units);
}
