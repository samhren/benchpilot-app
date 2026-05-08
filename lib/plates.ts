export function calcPlates(weight: number, bar = 45): number[] {
  // Prefer common gym plates (skip 35s by default — most lifters reach for 25+10).
  const plates = [45, 25, 10, 5, 2.5];
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
  return plates.map((p) => (p % 1 === 0 ? p.toString() : p.toFixed(1))).join(" + ") + " / side";
}
