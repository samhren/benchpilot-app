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

export const LONG_GAP_DAYS = 14;

// Pure helper: derive the calendar date for a (programStartDate, weekNumber, dayOfWeek).
// dayOfWeek is 1..7 (Mon..Sun) consistent with dayOfWeekFromJs.
export function scheduledDateForDay(
  startDate: string | Date,
  weekNumber: number,
  dayOfWeek: number,
): Date {
  const start = typeof startDate === "string" ? new Date(startDate + "T00:00:00") : new Date(startDate);
  const startDow = dayOfWeekFromJs(start);
  const offsetDays = (weekNumber - 1) * 7 + (dayOfWeek - startDow);
  const out = new Date(start);
  out.setDate(out.getDate() + offsetDays);
  return out;
}

export function shouldSuggestLongGapDeload(
  lastCompletedAt: Date | null,
  today = new Date(),
): boolean {
  if (!lastCompletedAt) return false;
  const ms = today.getTime() - lastCompletedAt.getTime();
  const days = Math.floor(ms / 86400000);
  return days >= LONG_GAP_DAYS;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
