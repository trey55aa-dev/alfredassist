import { describe, it, expect } from "vitest";
import { buildRecovery } from "@/lib/habits";
import type { Habit, HabitLog } from "@/lib/habits";

// A daily habit last completed 2026-07-28. "Today" varies per test to check
// the one-day grace: yesterday is never a miss, and today isn't over yet.
const HABIT: Habit = { id: "h1", title: "Train body", cadence: "daily", createdAt: 0 };
const LOGS: HabitLog[] = [{ habitId: "h1", date: "2026-07-28" }];

describe("buildRecovery — daily grace window", () => {
  it("is not at risk the same day it was done", () => {
    expect(buildRecovery(HABIT, LOGS, new Date(2026, 6, 28, 12))).toBeNull();
  });

  it("is not at risk the day after (yesterday is grace)", () => {
    expect(buildRecovery(HABIT, LOGS, new Date(2026, 6, 29, 12))).toBeNull();
  });

  it("is still not at risk two days after (today pending + yesterday grace)", () => {
    expect(buildRecovery(HABIT, LOGS, new Date(2026, 6, 30, 12))).toBeNull();
  });

  it("becomes at risk three days after, counting only the one genuine miss", () => {
    const r = buildRecovery(HABIT, LOGS, new Date(2026, 6, 31, 12));
    expect(r).not.toBeNull();
    expect(r!.missedPeriods).toBe(1);
  });

  it("keeps counting real misses beyond the grace window", () => {
    const r = buildRecovery(HABIT, LOGS, new Date(2026, 7, 2, 12)); // Aug 2
    expect(r).not.toBeNull();
    expect(r!.missedPeriods).toBe(3);
  });

  it("never-done habits still coach onboarding with 1 missed period", () => {
    const fresh: Habit = { id: "h2", title: "Read", cadence: "daily", createdAt: 0 };
    const r = buildRecovery(fresh, [], new Date(2026, 6, 31, 12));
    expect(r).not.toBeNull();
    expect(r!.missedPeriods).toBe(1);
  });
});
