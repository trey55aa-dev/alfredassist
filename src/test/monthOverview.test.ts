import { describe, it, expect } from "vitest";
import { computeMonthOverview } from "@/lib/monthOverview";
import type { Habit, HabitLog } from "@/lib/habits";
import type { Goal } from "@/lib/goals";

const NOW = new Date(2026, 5, 15, 12, 0, 0); // Jun 15 2026, noon
const YEAR = 2026;
const MONTH = 5; // June (0-indexed)

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function daysAgo(n: number): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() + n);
  return d;
}

function dailyHabit(id: string, createdAt: Date): Habit {
  return { id, title: `Habit ${id}`, cadence: "daily", createdAt: createdAt.getTime() };
}

/** 100-day window (50 days elapsed, 50 to go), so pace target ≈ elapsed days. */
function paceGoal(id: string, current: number, progressLog: Record<string, number> = {}): Goal {
  return {
    id,
    title: `Goal ${id}`,
    category: "Skills",
    timeframe: "quarterly",
    quarter: null,
    done: false,
    createdAt: daysAgo(50).getTime(),
    deadline: daysFromNow(50).toISOString(),
    target: 100,
    current,
    progressLog,
  };
}

function findDay(days: ReturnType<typeof computeMonthOverview>, date: Date) {
  const day = days.find((d) => d.ymd === fmt(date));
  if (!day) throw new Error(`day ${fmt(date)} not found in grid`);
  return day;
}

describe("computeMonthOverview", () => {
  it("marks a past day with a missed daily habit as behind_critical", () => {
    const habit = dailyHabit("h1", new Date(2026, 5, 1));
    const logs: HabitLog[] = [];
    for (let d = 1; d <= 14; d++) {
      if (d === 8) continue; // the miss
      logs.push({ habitId: "h1", date: `2026-06-${String(d).padStart(2, "0")}` });
    }
    const days = computeMonthOverview([], [habit], logs, {}, YEAR, MONTH, NOW);
    const missedDay = findDay(days, new Date(2026, 5, 8));
    expect(missedDay.tone).toBe("behind_critical");
    expect(missedDay.isFuture).toBe(false);
  });

  it("marks a past day with a goal logged below pace as behind", () => {
    // 10 days ago: elapsed 40/100 → pace target 40. Logged 30 → ratio 0.75.
    const d = daysAgo(10);
    const goal = paceGoal("g1", 30, { [fmt(d)]: 30 });
    const days = computeMonthOverview([goal], [], [], {}, YEAR, MONTH, NOW);
    const day = findDay(days, d);
    expect(day.tone).toBe("behind");
    expect(day.isFuture).toBe(false);
  });

  it("marks a past day logged right on pace as on_pace", () => {
    // 5 days ago: elapsed 45/100 → pace target 45. Logged 45 → ratio 1.0.
    const d = daysAgo(5);
    const goal = paceGoal("g1", 45, { [fmt(d)]: 45 });
    const days = computeMonthOverview([goal], [], [], {}, YEAR, MONTH, NOW);
    expect(findDay(days, d).tone).toBe("on_pace");
  });

  it("returns no_data for a day with nothing tracked", () => {
    const goal = paceGoal("g1", 45, {}); // no check-ins at all
    const days = computeMonthOverview([goal], [], [], {}, YEAR, MONTH, NOW);
    // A day within the visible grid, but with no logged check-in.
    expect(findDay(days, new Date(2026, 5, 3)).tone).toBe("no_data");
  });

  it("projects a future day as behind_critical when current pace is far short", () => {
    // current pace 5/50 elapsed = 0.1/day. 10 days out: projected 6 vs pace target 60.
    const goal = paceGoal("g1", 5);
    const days = computeMonthOverview([goal], [], [], {}, YEAR, MONTH, NOW);
    const future = findDay(days, daysFromNow(10));
    expect(future.tone).toBe("behind_critical");
    expect(future.isFuture).toBe(true);
  });

  it("does not fabricate a habit forecast — future days are no_data with habits only", () => {
    const habit = dailyHabit("h1", daysAgo(30));
    const logs: HabitLog[] = [{ habitId: "h1", date: fmt(NOW) }];
    const days = computeMonthOverview([], [habit], logs, {}, YEAR, MONTH, NOW);
    const future = findDay(days, daysFromNow(5));
    expect(future.tone).toBe("no_data");
    expect(future.isFuture).toBe(true);
  });
});
