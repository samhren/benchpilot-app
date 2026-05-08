import { describe, expect, it } from "vitest";
import {
  LONG_GAP_DAYS,
  computeProgramWeek,
  dayOfWeekFromJs,
  isoDate,
  scheduledDateForDay,
  shouldSuggestLongGapDeload,
} from "./program-state";

describe("dayOfWeekFromJs", () => {
  it("Monday is 1, Sunday is 7", () => {
    expect(dayOfWeekFromJs(new Date("2026-05-04T12:00:00"))).toBe(1); // Mon
    expect(dayOfWeekFromJs(new Date("2026-05-10T12:00:00"))).toBe(7); // Sun
  });
});

describe("computeProgramWeek", () => {
  it("returns 1 on the start date", () => {
    expect(computeProgramWeek("2026-05-01", new Date("2026-05-01T12:00:00"))).toBe(1);
  });
  it("rolls into week 2 after 7 days", () => {
    expect(computeProgramWeek("2026-05-01", new Date("2026-05-08T12:00:00"))).toBe(2);
  });
  it("clamps to 14", () => {
    expect(computeProgramWeek("2024-01-01", new Date("2026-05-08T12:00:00"))).toBe(14);
  });
});

describe("scheduledDateForDay", () => {
  it("returns the start date for week 1, dayOfWeek == start dayOfWeek", () => {
    // 2026-05-04 is a Monday → dow 1
    const d = scheduledDateForDay("2026-05-04", 1, 1);
    expect(isoDate(d)).toBe("2026-05-04");
  });
  it("walks forward across weeks", () => {
    const d = scheduledDateForDay("2026-05-04", 2, 1);
    expect(isoDate(d)).toBe("2026-05-11");
  });
  it("walks within a week", () => {
    // start Mon, dow 5 (Fri) of week 1 → Fri
    const d = scheduledDateForDay("2026-05-04", 1, 5);
    expect(isoDate(d)).toBe("2026-05-08");
  });
  it("handles a non-Monday start", () => {
    // 2026-05-06 is Wed (dow 3). Week 1 dow 3 → 2026-05-06; week 1 dow 5 → 2026-05-08
    expect(isoDate(scheduledDateForDay("2026-05-06", 1, 3))).toBe("2026-05-06");
    expect(isoDate(scheduledDateForDay("2026-05-06", 1, 5))).toBe("2026-05-08");
    expect(isoDate(scheduledDateForDay("2026-05-06", 2, 3))).toBe("2026-05-13");
  });
});

describe("shouldSuggestLongGapDeload", () => {
  const today = new Date("2026-05-08T12:00:00");
  it("false when never trained", () => {
    expect(shouldSuggestLongGapDeload(null, today)).toBe(false);
  });
  it("false when last session was 5 days ago", () => {
    const last = new Date("2026-05-03T12:00:00");
    expect(shouldSuggestLongGapDeload(last, today)).toBe(false);
  });
  it("true at exactly the 14-day threshold", () => {
    const last = new Date(today);
    last.setDate(last.getDate() - LONG_GAP_DAYS);
    expect(shouldSuggestLongGapDeload(last, today)).toBe(true);
  });
  it("true when last session was 30 days ago", () => {
    const last = new Date("2026-04-08T12:00:00");
    expect(shouldSuggestLongGapDeload(last, today)).toBe(true);
  });
});
