export type Block = 1 | 2 | 3 | "deload" | "test";

export function getCurrentBlock(weekNumber: number): Block {
  if (weekNumber >= 1 && weekNumber <= 4) return 1;
  if (weekNumber >= 5 && weekNumber <= 8) return 2;
  if (weekNumber >= 9 && weekNumber <= 12) return 3;
  if (weekNumber === 13) return "deload";
  if (weekNumber === 14) return "test";
  throw new Error(`Invalid week number: ${weekNumber}`);
}

export function getWeekInBlock(weekNumber: number): 1 | 2 | 3 | 4 {
  const block = getCurrentBlock(weekNumber);
  if (block === "deload" || block === "test") {
    throw new Error(`Week ${weekNumber} is not in a numbered block`);
  }
  const wk = ((weekNumber - 1) % 4) + 1;
  return wk as 1 | 2 | 3 | 4;
}
