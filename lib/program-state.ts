// Program state helpers — current week / day, today's session, etc.
import { db } from "@/lib/db";
import { programs } from "@/lib/db/schema";
import { getCurrentBlock, type Block } from "@/lib/programming/blocks";
import { eq } from "drizzle-orm";

// Format a Date as YYYY-MM-DD in the given IANA timezone.
export function isoDateInTz(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${day}`;
}

// 1 = Mon, 7 = Sun, evaluated in tz.
export function dayOfWeekInTz(d: Date, tz: string): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(d);
  const map: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  };
  return map[wd] ?? 1;
}

// Backwards-compatible: when tz omitted, uses host local time. Server callers should pass tz.
export function dayOfWeekFromJs(d: Date, tz?: string): number {
  if (tz) return dayOfWeekInTz(d, tz);
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

export function isoDate(d: Date, tz?: string): string {
  if (tz) return isoDateInTz(d, tz);
  return d.toISOString().slice(0, 10);
}

function daysBetweenIso(aIso: string, bIso: string): number {
  const a = new Date(aIso + "T00:00:00Z").getTime();
  const b = new Date(bIso + "T00:00:00Z").getTime();
  return Math.floor((b - a) / 86400000);
}

export function computeProgramWeek(
  startDate: string | Date,
  today: Date = new Date(),
  tz?: string,
): number {
  const startIso =
    typeof startDate === "string" ? startDate : isoDate(startDate, tz);
  const todayIso = isoDate(today, tz);
  const days = daysBetweenIso(startIso, todayIso);
  const week = Math.floor(days / 7) + 1;
  return Math.min(Math.max(week, 1), 14);
}

export interface ProgramProgress {
  week: number;
  totalWeeks: number;
  block: Block;
  blockLabel: string;
}

export function getProgramProgress(
  startDate: string | Date,
  today: Date = new Date(),
  tz?: string,
  totalWeeks = 14,
): ProgramProgress {
  const week = computeProgramWeek(startDate, today, tz);
  const block = getCurrentBlock(week);
  const blockLabel =
    block === "deload" ? "Deload" : block === "test" ? "Test" : `Block ${block}`;
  return { week, totalWeeks, block, blockLabel };
}

export async function setCurrentProgramWeek(programId: string, weekNumber: number) {
  await db
    .update(programs)
    .set({ currentWeek: weekNumber })
    .where(eq(programs.id, programId));
}

export const LONG_GAP_DAYS = 14;

// Pure helper: derive the calendar date (YYYY-MM-DD) for (startDate, weekNumber, dayOfWeek).
// Walks dates as UTC midnight, so the result is timezone-independent.
export function scheduledDateForDay(
  startDate: string | Date,
  weekNumber: number,
  dayOfWeek: number,
): string {
  const startIso =
    typeof startDate === "string"
      ? startDate
      : startDate.toISOString().slice(0, 10);
  const start = new Date(startIso + "T00:00:00Z");
  const startDow = ((start.getUTCDay() + 6) % 7) + 1; // 1..7 Mon..Sun
  const offsetDays = (weekNumber - 1) * 7 + (dayOfWeek - startDow);
  const out = new Date(start);
  out.setUTCDate(out.getUTCDate() + offsetDays);
  return out.toISOString().slice(0, 10);
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
