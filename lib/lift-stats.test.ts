import { describe, expect, it } from "vitest";
import {
  computeLiftStats,
  e1rmSeries,
  epleyE1rm,
  repPrs,
  trainingStreak,
  weekStart,
  weeklyBuckets,
  workingSets,
  type StatSet,
} from "./lift-stats";

const UTC = "UTC";

// Build a set; defaults are a normal working set.
function set(p: Partial<StatSet> & Pick<StatSet, "completedAt" | "sessionId">): StatSet {
  return {
    weight: 200,
    reps: 5,
    isWarmup: false,
    isAmrap: false,
    ...p,
  };
}

describe("epleyE1rm", () => {
  it("1 rep returns the weight itself (≈)", () => {
    expect(epleyE1rm(200, 1)).toBeCloseTo(200 * (1 + 1 / 30));
  });
  it("caps reps at 12 so high-rep AMRAPs don't explode", () => {
    expect(epleyE1rm(135, 20)).toBe(epleyE1rm(135, 12));
  });
  it("floors reps at 1", () => {
    expect(epleyE1rm(200, 0)).toBe(epleyE1rm(200, 1));
  });
});

describe("workingSets", () => {
  it("drops warmups and zero-load/zero-rep junk", () => {
    const rows = [
      set({ completedAt: "2026-01-01T10:00:00Z", sessionId: "a", isWarmup: true }),
      set({ completedAt: "2026-01-01T10:05:00Z", sessionId: "a", weight: 0 }),
      set({ completedAt: "2026-01-01T10:10:00Z", sessionId: "a", reps: 0 }),
      set({ completedAt: "2026-01-01T10:15:00Z", sessionId: "a" }),
    ];
    expect(workingSets(rows)).toHaveLength(1);
  });
});

describe("weekStart", () => {
  it("snaps any weekday back to its Monday", () => {
    // 2026-05-16 is a Saturday → Monday is 2026-05-11
    expect(weekStart(new Date("2026-05-16T12:00:00Z"), UTC)).toBe("2026-05-11");
    expect(weekStart(new Date("2026-05-11T00:00:00Z"), UTC)).toBe("2026-05-11");
    expect(weekStart(new Date("2026-05-17T23:00:00Z"), UTC)).toBe("2026-05-11");
  });
});

describe("e1rmSeries", () => {
  it("keeps the top-estimate set per session, ordered by time", () => {
    const rows = [
      set({ completedAt: "2026-01-08T10:00:00Z", sessionId: "s2", weight: 210, reps: 3 }),
      set({ completedAt: "2026-01-01T10:00:00Z", sessionId: "s1", weight: 185, reps: 5 }),
      set({ completedAt: "2026-01-01T10:20:00Z", sessionId: "s1", weight: 200, reps: 5 }),
    ];
    const series = e1rmSeries(rows);
    expect(series.map((p) => p.weight)).toEqual([200, 210]);
  });
});

describe("repPrs", () => {
  it("tracks the heaviest weight per rep threshold", () => {
    const rows = [
      set({ completedAt: "2026-01-01T10:00:00Z", sessionId: "s1", weight: 225, reps: 1 }),
      set({ completedAt: "2026-01-02T10:00:00Z", sessionId: "s2", weight: 200, reps: 5 }),
      set({ completedAt: "2026-01-03T10:00:00Z", sessionId: "s3", weight: 185, reps: 10 }),
    ];
    const prs = repPrs(rows);
    expect(prs.find((r) => r.reps === 1)?.pr?.weight).toBe(225);
    // 225x1 also counts toward the ≥1 PR but not ≥5; 200x5 is the ≥5 best.
    expect(prs.find((r) => r.reps === 5)?.pr?.weight).toBe(200);
    expect(prs.find((r) => r.reps === 10)?.pr?.weight).toBe(185);
  });
});

describe("weeklyBuckets", () => {
  it("sums tonnage and counts sessions per week", () => {
    const rows = [
      set({ completedAt: "2026-05-11T10:00:00Z", sessionId: "a", weight: 200, reps: 5 }),
      set({ completedAt: "2026-05-13T10:00:00Z", sessionId: "b", weight: 100, reps: 10 }),
      set({ completedAt: "2026-05-18T10:00:00Z", sessionId: "c", weight: 150, reps: 4 }),
    ];
    const weeks = weeklyBuckets(rows, UTC);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]).toMatchObject({ weekStart: "2026-05-11", volume: 2000, sessions: 2 });
    expect(weeks[1]).toMatchObject({ weekStart: "2026-05-18", volume: 600, sessions: 1 });
  });
});

describe("trainingStreak", () => {
  it("counts consecutive weeks back from the latest", () => {
    expect(trainingStreak(["2026-05-04", "2026-05-11", "2026-05-18"], "2026-05-18")).toBe(3);
  });
  it("breaks on a gap", () => {
    expect(trainingStreak(["2026-04-20", "2026-05-11", "2026-05-18"], "2026-05-18")).toBe(2);
  });
  it("returns 0 when the latest week is stale", () => {
    expect(trainingStreak(["2026-04-06", "2026-04-13"], "2026-05-18")).toBe(0);
  });
  it("stays alive if the current week is empty but last week trained", () => {
    expect(trainingStreak(["2026-05-04", "2026-05-11"], "2026-05-18")).toBe(2);
  });
});

describe("computeLiftStats", () => {
  it("derives volume deltas and totals", () => {
    const today = new Date("2026-05-16T12:00:00Z"); // week of 2026-05-11
    const rows = [
      set({ completedAt: "2026-05-04T10:00:00Z", sessionId: "s1", weight: 200, reps: 5 }),
      set({ completedAt: "2026-05-12T10:00:00Z", sessionId: "s2", weight: 210, reps: 5 }),
    ];
    const stats = computeLiftStats(rows, UTC, today);
    expect(stats.totalSets).toBe(2);
    expect(stats.totalSessions).toBe(2);
    expect(stats.thisWeekVolume).toBe(1050); // 210 * 5
    expect(stats.lastWeekVolume).toBe(1000); // 200 * 5
    expect(stats.currentE1rm).toBe(Math.round(epleyE1rm(210, 5)));
    expect(stats.startE1rm).toBe(Math.round(epleyE1rm(200, 5)));
  });
  it("is empty-safe", () => {
    const stats = computeLiftStats([], UTC, new Date("2026-05-16T12:00:00Z"));
    expect(stats.bestSet).toBeNull();
    expect(stats.currentE1rm).toBeNull();
    expect(stats.streakWeeks).toBe(0);
    expect(stats.avgSessionVolume).toBe(0);
  });
});
