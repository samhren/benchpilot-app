// Program state helpers — current week / day, today's session, etc.
import { db } from "@/lib/db";
import { programs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export function dayOfWeekFromJs(d: Date): number {
  // 1 = Mon, 7 = Sun
  const js = d.getDay(); // 0 Sun ... 6 Sat
  return js === 0 ? 7 : js;
}

export function computeProgramWeek(startDate: string | Date, today = new Date()): number {
  const start = typeof startDate === "string" ? new Date(startDate + "T00:00:00") : startDate;
  const ms = today.getTime() - start.getTime();
  const days = Math.floor(ms / 86400000);
  const week = Math.floor(days / 7) + 1;
  return Math.min(Math.max(week, 1), 14);
}

export async function setCurrentProgramWeek(programId: string, weekNumber: number) {
  await db
    .update(programs)
    .set({ currentWeek: weekNumber })
    .where(eq(programs.id, programId));
}
