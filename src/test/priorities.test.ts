import { describe, it, expect } from "vitest";
import { pickTodayFocus } from "@/lib/priorities";
import type { Habit, HabitLog } from "@/lib/habits";
import type { Goal } from "@/lib/goals";

const NOW = new Date(2026, 5, 15, 12, 0, 0); // Jun 15 2026, noon

function dailyHabit(id: string, title = "Habit"): Habit {
  return { id, title, cadence: "daily", createdAt: new Date(2026, 0, 1).getTime() };
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return ymd(d);
}

/** Behind/critical-pace goal: 90-day window, 60 days elapsed, barely any progress. */
function behindCriticalGoal(id: string, deadlineDaysOut: number): Goal {
  const start = new Date(NOW);
  start.setDate(start.getDate() - 60);
  const deadline = new Date(NOW);
  deadline.setDate(deadline.getDate() + deadlineDaysOut);
  return {
    id,
    title: `Goal ${id}`,
    category: "Money",
    timeframe: "quarterly",
    quarter: null,
    done: false,
    createdAt: start.getTime(),
    target: 100,
    current: 2,
    deadline: deadline.toISOString(),
  };
}

/** Modestly-behind (not critical) goal. */
function behindGoal(id: string): Goal {
  const start = new Date(NOW);
  start.setDate(start.getDate() - 10);
  const deadline = new Date(NOW);
  deadline.setDate(deadline.getDate() + 10);
  return {
    id,
    title: `Goal ${id}`,
    category: "Skills",
    timeframe: "quarterly",
    quarter: null,
    done: false,
    createdAt: start.getTime(),
    target: 100,
    current: 40, // 40% done at the halfway point → behind (ratio ~0.67), not critical
    deadline: deadline.toISOString(),
  };
}

/** On-pace goal. */
function onPaceGoal(id: string): Goal {
  const start = new Date(NOW);
  start.setDate(start.getDate() - 10);
  const deadline = new Date(NOW);
  deadline.setDate(deadline.getDate() + 10);
  return {
    id,
    title: `Goal ${id}`,
    category: "Skills",
    timeframe: "quarterly",
    quarter: null,
    done: false,
    createdAt: start.getTime(),
    target: 100,
    current: 50,
    deadline: deadline.toISOString(),
  };
}

/** Never-started goal ("missing" status). */
function missingGoal(id: string, deadlineDaysOut: number): Goal {
  const deadline = new Date(NOW);
  deadline.setDate(deadline.getDate() + deadlineDaysOut);
  return {
    id,
    title: `Goal ${id}`,
    category: "Skills",
    timeframe: "quarterly",
    quarter: null,
    done: false,
    createdAt: NOW.getTime(),
    target: 100,
    current: 0,
    deadline: deadline.toISOString(),
  };
}

describe("pickTodayFocus", () => {
  it("returns null with no goals or habits", () => {
    expect(pickTodayFocus([], [], [], NOW)).toBeNull();
  });

  it("a broken habit streak (missedPeriods > 1) beats an on-pace goal", () => {
    const habit = dailyHabit("h1");
    const logs: HabitLog[] = [{ habitId: "h1", date: daysAgo(3) }]; // last done 3 days ago
    const pick = pickTodayFocus([onPaceGoal("g1")], [habit], logs, NOW);
    expect(pick?.kind).toBe("habit");
    if (pick?.kind === "habit") {
      expect(pick.recovery.habit.id).toBe("h1");
      expect(pick.recovery.missedPeriods).toBeGreaterThan(1);
    }
  });

  it("a behind_critical goal beats a behind goal and a habit due today", () => {
    const habit = dailyHabit("h1");
    const logs: HabitLog[] = [{ habitId: "h1", date: daysAgo(1) }]; // done yesterday, not today → missedPeriods 1
    const pick = pickTodayFocus(
      [behindGoal("g-behind"), behindCriticalGoal("g-critical", 30)],
      [habit],
      logs,
      NOW,
    );
    expect(pick).toEqual({
      kind: "goal",
      goal: expect.objectContaining({ id: "g-critical" }),
      projection: expect.objectContaining({ status: "behind_critical" }),
    });
  });

  it("a never-started goal is picked when nothing more urgent qualifies", () => {
    const pick = pickTodayFocus([onPaceGoal("g-ok"), missingGoal("g-new", 20)], [], [], NOW);
    expect(pick?.kind).toBe("goal");
    if (pick?.kind === "goal") {
      expect(pick.goal.id).toBe("g-new");
      expect(pick.projection.status).toBe("missing");
    }
  });

  it("breaks ties between two behind_critical goals by nearest deadline", () => {
    const pick = pickTodayFocus(
      [behindCriticalGoal("g-far", 60), behindCriticalGoal("g-near", 10)],
      [],
      [],
      NOW,
    );
    expect(pick?.kind).toBe("goal");
    if (pick?.kind === "goal") expect(pick.goal.id).toBe("g-near");
  });

  it("returns null (all-clear) when everything is on pace or already done", () => {
    const habit = dailyHabit("h1");
    const logs: HabitLog[] = [{ habitId: "h1", date: ymd(NOW) }]; // done today
    const pick = pickTodayFocus([onPaceGoal("g1")], [habit], logs, NOW);
    expect(pick).toBeNull();
  });
});
