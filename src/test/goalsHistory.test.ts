import { describe, it, expect } from "vitest";
import { paceTargetByDate, computeProjection } from "@/lib/goalsHistory";
import type { Goal } from "@/lib/goals";

function mkGoal(p: Partial<Goal> = {}): Goal {
  return {
    id: "g",
    title: "Save",
    category: "Money",
    timeframe: "annual",
    quarter: null,
    done: false,
    createdAt: new Date(2026, 0, 1).getTime(),
    ...p,
  } as Goal;
}

describe("paceTargetByDate", () => {
  it("returns null without a numeric target or a deadline", () => {
    expect(paceTargetByDate(mkGoal({ deadline: new Date(2026, 11, 31).toISOString() }), new Date())).toBeNull();
    expect(paceTargetByDate(mkGoal({ target: 100 }), new Date())).toBeNull();
  });

  it("interpolates linearly from start to deadline", () => {
    const goal = mkGoal({ target: 100, deadline: new Date(2026, 11, 31, 23, 59, 59).toISOString() });
    // At the start (Jan 1) → 0; at the deadline → target.
    expect(paceTargetByDate(goal, new Date(2026, 0, 1))).toBe(0);
    expect(paceTargetByDate(goal, new Date(2026, 11, 31, 23, 59, 59))).toBe(100);
    // Mid-year ≈ half the target.
    const mid = paceTargetByDate(goal, new Date(2026, 5, 30))!;
    expect(mid).toBeGreaterThan(45);
    expect(mid).toBeLessThan(55);
  });

  it("clamps outside the [start, deadline] window", () => {
    const goal = mkGoal({ target: 100, deadline: new Date(2026, 11, 31).toISOString() });
    expect(paceTargetByDate(goal, new Date(2025, 0, 1))).toBe(0);   // before start
    expect(paceTargetByDate(goal, new Date(2027, 0, 1))).toBe(100); // after deadline
  });
});

describe("computeProjection", () => {
  it("reports completion for a done goal", () => {
    expect(computeProjection(mkGoal({ done: true })).status).toBe("complete");
  });

  it("has no data without a measurable target", () => {
    expect(computeProjection(mkGoal()).status).toBe("no_data");
  });

  it("reports target reached when current >= target", () => {
    expect(computeProjection(mkGoal({ target: 50, current: 50 })).status).toBe("complete");
  });

  it("computes the required daily rate to hit the deadline", () => {
    const now = new Date(2026, 5, 1, 12, 0, 0);
    const goal = mkGoal({
      target: 100,
      current: 0,
      createdAt: now.getTime(),
      deadline: new Date(2026, 5, 11, 12, 0, 0).toISOString(), // 10 days out
    });
    const proj = computeProjection(goal, now);
    expect(proj.requiredDailyRate).not.toBeNull();
    expect(proj.requiredDailyRate!).toBeGreaterThan(9);
    expect(proj.requiredDailyRate!).toBeLessThan(11); // 100 / ~10 days
    // Jun 1 through Jun 11 inclusive — the deadline day is still usable.
    expect(proj.daysLeft).toBe(11);
  });

  it("reads a deadline saved by the date picker, not just a plain date string", () => {
    // The picker stores toISOString(); appending a time to that used to yield
    // an Invalid Date and silently NaN'd every downstream pace figure.
    const now = new Date(2026, 5, 1, 12, 0, 0);
    const goal = mkGoal({
      target: 100,
      current: 0,
      createdAt: now.getTime(),
      deadline: new Date(2026, 5, 11, 12, 0, 0).toISOString(),
    });
    const proj = computeProjection(goal, now);
    expect(Number.isFinite(proj.daysLeft!)).toBe(true);
    expect(Number.isFinite(proj.requiredDailyRate!)).toBe(true);
  });

  it("never reports a day count larger than the goal's own window", () => {
    // The old math extrapolated shortfall / actual-rate with no bound, which
    // produced five-digit "days behind" figures on barely-started goals.
    const start = new Date(2026, 0, 1, 12, 0, 0);
    const now = new Date(2026, 7, 25, 12, 0, 0);
    const goal = mkGoal({
      target: 90,
      current: 1,
      createdAt: start.getTime(),
      deadline: "2026-12-31",
    });
    const proj = computeProjection(goal, now);
    expect(proj.daysLate).toBeNull();
    expect(proj.label).not.toMatch(/\d{4,}/); // no runaway numbers in the copy
  });

  it("reports how far behind in units, bounded by the target", () => {
    const now = new Date(2026, 7, 25, 12, 0, 0);
    const goal = mkGoal({
      target: 12,
      current: 2,
      unit: "books",
      createdAt: new Date(2026, 0, 1).getTime(),
      deadline: "2026-12-31",
    });
    const proj = computeProjection(goal, now);
    expect(proj.paceTarget).toBeGreaterThan(2);
    expect(proj.paceTarget!).toBeLessThanOrEqual(12);
    expect(proj.behindBy).toBe(proj.paceTarget! - 2);
    expect(proj.label).toContain("Behind by");
  });

  it("does not apply cumulative-rate math to streak goals", () => {
    const goal = mkGoal({
      target: 90,
      current: 3,
      goalType: "streak",
      deadline: "2026-12-31",
      createdAt: new Date(2026, 0, 1).getTime(),
    });
    const proj = computeProjection(goal, new Date(2026, 7, 25));
    expect(proj.status).toBe("streak");
    expect(proj.daysLate).toBeNull();
    expect(proj.label).toBe("");
  });

  it("keeps the far-behind message supportive, not shaming (grace before penalty)", () => {
    // Way behind pace: 60 days elapsed of a 90-day window, barely any progress.
    const start = new Date(2026, 0, 1, 12, 0, 0);
    const now = new Date(2026, 2, 2, 12, 0, 0); // 60 days after start
    const goal = mkGoal({
      target: 100,
      current: 2,
      createdAt: start.getTime(),
      deadline: new Date(2026, 3, 1, 12, 0, 0).toISOString(), // 90 days after start
    });
    const proj = computeProjection(goal, now);
    expect(proj.status).toBe("behind_critical");
    expect(proj.label.toLowerCase()).not.toContain("falling apart");
    expect(proj.detail?.toLowerCase()).not.toContain("slips further");
    expect(proj.detail?.toLowerCase()).not.toContain("cut the target");
  });
});
