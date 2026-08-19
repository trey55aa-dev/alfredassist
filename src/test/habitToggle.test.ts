import { describe, it, expect, beforeEach } from "vitest";
import { applyHabitToggle } from "@/lib/habitToggle";
import { todayKey } from "@/lib/alfred";
import type { Habit, HabitLog } from "@/lib/habits";
import type { Goal } from "@/lib/goals";

const TODAY = todayKey();

function habit(patch: Partial<Habit> = {}): Habit {
  return { id: "h1", title: "Log meals", cadence: "daily", createdAt: 0, ...patch };
}

function goal(patch: Partial<Goal> = {}): Goal {
  return {
    id: "g1", title: "Lose 15 lbs", category: "Body", timeframe: "annual",
    quarter: null, done: false, createdAt: 0, ...patch,
  };
}

beforeEach(() => localStorage.clear());

describe("applyHabitToggle", () => {
  it("ticks an untouched habit for today", () => {
    const r = applyHabitToggle(habit(), [], []);
    expect(r.nowComplete).toBe(true);
    expect(r.logs).toEqual([{ habitId: "h1", date: TODAY }]);
  });

  it("unticks a habit already done today", () => {
    const logs: HabitLog[] = [{ habitId: "h1", date: TODAY }];
    const r = applyHabitToggle(habit(), logs, []);
    expect(r.nowComplete).toBe(false);
    expect(r.logs).toEqual([]);
  });

  it("leaves other habits' logs alone", () => {
    const logs: HabitLog[] = [{ habitId: "h2", date: TODAY }];
    const r = applyHabitToggle(habit(), logs, []);
    expect(r.logs).toContainEqual({ habitId: "h2", date: TODAY });
    expect(r.logs).toContainEqual({ habitId: "h1", date: TODAY });
  });

  it("advances a linked goal on tick and rolls it back on untick", () => {
    const g = goal({ current: 4, target: 15 });
    const ticked = applyHabitToggle(habit({ goalId: "g1" }), [], [g]);
    expect(ticked.goals[0].current).toBe(5);

    const unticked = applyHabitToggle(habit({ goalId: "g1" }), ticked.logs, ticked.goals);
    expect(unticked.goals[0].current).toBe(4);
  });

  it("respects goalIncrement and never exceeds the target", () => {
    const g = goal({ current: 9, target: 10 });
    const r = applyHabitToggle(habit({ goalId: "g1", goalIncrement: 5 }), [], [g]);
    expect(r.goals[0].current).toBe(10); // clamped, not 14
  });

  it("never drives a goal below zero on untick", () => {
    const g = goal({ current: 0, target: 10 });
    const logs: HabitLog[] = [{ habitId: "h1", date: TODAY }];
    const r = applyHabitToggle(habit({ goalId: "g1", goalIncrement: 3 }), logs, [g]);
    expect(r.goals[0].current).toBe(0);
  });

  it("returns the same goals array when no goal is linked", () => {
    const goals = [goal()];
    const r = applyHabitToggle(habit(), [], goals);
    expect(r.goals).toBe(goals); // referentially unchanged — callers skip the write
  });

  it("does not touch goals other than the linked one", () => {
    const other = goal({ id: "g2", title: "Read 12 books", current: 3 });
    const r = applyHabitToggle(habit({ goalId: "g1" }), [], [goal({ current: 4 }), other]);
    expect(r.goals[1]).toBe(other);
  });
});
