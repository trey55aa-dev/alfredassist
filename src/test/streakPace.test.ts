import { describe, it, expect } from "vitest";
import { streakPace } from "@/lib/goalsAnalytics";
import type { Goal } from "@/lib/goals";

const NOW = new Date(2026, 7, 25, 12, 0, 0); // Aug 25 2026

/** A streak goal with `streak` consecutive done days ending today. */
function mkStreak(streak: number, p: Partial<Goal> = {}): Goal {
  const dailyLog: Record<string, { done: boolean }> = {};
  for (let i = 0; i < streak; i++) {
    const d = new Date(NOW);
    d.setDate(d.getDate() - i);
    dailyLog[
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    ] = { done: true };
  }
  return {
    id: "g",
    title: "90 days clean",
    category: "Body",
    timeframe: "quarterly",
    quarter: null,
    goalType: "streak",
    target: 90,
    done: false,
    createdAt: new Date(2026, 0, 1).getTime(),
    dailyLog,
    ...p,
  } as Goal;
}

describe("streakPace", () => {
  it("measures against days left, not elapsed calendar time", () => {
    // The reported bug: 3-day streak toward 90, ~128 days left in the year.
    // This is comfortably achievable and must never read as thousands behind.
    const pace = streakPace(mkStreak(3, { deadline: "2026-12-31" }), NOW);
    expect(pace.needed).toBe(87);
    expect(pace.daysLeft).toBeGreaterThan(120);
    expect(pace.slack).toBeGreaterThan(0);
    expect(pace.status).toBe("comfortable");
    expect(pace.label).not.toMatch(/\d{4,}/);
  });

  it("gives the latest date a fresh run could still start", () => {
    const pace = streakPace(mkStreak(0, { deadline: "2026-12-31" }), NOW);
    // 90 needed, 129 left → 39 spare days. Starting Oct 3 puts day 90 exactly
    // on Dec 31, so that's the last date a fresh run still fits.
    expect(pace.latestStart).toBe("2026-10-03");
  });

  it("flags when the run no longer fits, and stays recoverable about it", () => {
    const pace = streakPace(mkStreak(0, { deadline: "2026-09-30" }), NOW);
    expect(pace.status).toBe("not_enough_time");
    expect(pace.slack!).toBeLessThan(0);
    // Offers a way back rather than declaring failure.
    expect(pace.detail).toMatch(/deadline|instead/i);
    expect(pace.detail.toLowerCase()).not.toContain("failed");
  });

  it("reports completion once the streak reaches the target", () => {
    const pace = streakPace(mkStreak(90, { deadline: "2026-12-31" }), NOW);
    expect(pace.needed).toBe(0);
    expect(pace.status).toBe("reached");
  });

  it("handles a goal with no deadline without inventing one", () => {
    const pace = streakPace(mkStreak(5, { deadline: undefined }), NOW);
    expect(pace.status).toBe("no_deadline");
    expect(pace.daysLeft).toBeNull();
    expect(pace.slack).toBeNull();
  });
});
