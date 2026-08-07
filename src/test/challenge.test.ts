import { describe, it, expect } from "vitest";
import { challengeStatus, computeAdherence, type ChallengeConfig } from "@/lib/challenge";
import type { Habit, HabitLog } from "@/lib/habits";
import type { RecurringTemplate } from "@/lib/recurring";

const CFG: ChallengeConfig = { title: "35-Day Reset", startDate: "2026-08-08", totalDays: 35 };

describe("challengeStatus", () => {
  it("is upcoming before the start date", () => {
    const s = challengeStatus(CFG, new Date(2026, 7, 5)); // Aug 5
    expect(s.state).toBe("upcoming");
    expect(s.daysUntilStart).toBe(3);
    expect(s.pctElapsed).toBe(0);
  });

  it("is day 1 on the start date itself", () => {
    const s = challengeStatus(CFG, new Date(2026, 7, 8, 23, 59)); // Aug 8, late at night
    expect(s.state).toBe("active");
    expect(s.dayNumber).toBe(1);
  });

  it("counts up correctly mid-challenge", () => {
    const s = challengeStatus(CFG, new Date(2026, 7, 15)); // Aug 15 — 7 days after start
    expect(s.state).toBe("active");
    expect(s.dayNumber).toBe(8);
    expect(s.pctElapsed).toBeCloseTo(8 / 35);
  });

  it("still reads as active — Day 35 of 35 — on the final day itself", () => {
    const lastDay = new Date(2026, 7, 8);
    lastDay.setDate(lastDay.getDate() + 34); // 34 days after Aug 8 = day 35
    const s = challengeStatus(CFG, lastDay);
    expect(s.state).toBe("active");
    expect(s.dayNumber).toBe(35);
    expect(s.pctElapsed).toBe(1);
  });

  it("flips to complete starting the day after the final day, clamped at totalDays", () => {
    const dayAfter = new Date(2026, 7, 8);
    dayAfter.setDate(dayAfter.getDate() + 35);
    const s1 = challengeStatus(CFG, dayAfter);
    expect(s1.state).toBe("complete");
    expect(s1.dayNumber).toBe(35);

    const wayAfter = new Date(2026, 9, 1); // Oct 1 — long past the end
    const s2 = challengeStatus(CFG, wayAfter);
    expect(s2.state).toBe("complete");
    expect(s2.dayNumber).toBe(35);
    expect(s2.pctElapsed).toBe(1);
  });
});

describe("computeAdherence", () => {
  const dailyHabit: Habit = { id: "h1", title: "Drink water", cadence: "daily", createdAt: 0 };
  const weekdayBlock: RecurringTemplate = {
    id: "t1",
    title: "Recruiting Outreach",
    startTime: "09:00",
    endTime: "10:00",
    recurrence: "weekdays",
    days: [],
    enabled: true,
  };

  it("is zero before the challenge starts", () => {
    const r = computeAdherence(CFG, [dailyHabit], [], [], {}, new Date(2026, 7, 5));
    expect(r).toEqual({ pct: 0, completed: 0, applicable: 0 });
  });

  it("is 100% when every applicable item is logged every elapsed day", () => {
    // Aug 8 (Sat) through Aug 10 (Mon) — 3 days. weekdayBlock only applies Mon.
    const logs: HabitLog[] = [
      { habitId: "h1", date: "2026-08-08" },
      { habitId: "h1", date: "2026-08-09" },
      { habitId: "h1", date: "2026-08-10" },
    ];
    const completions = { "t1:2026-08-10": true as const };
    const r = computeAdherence(
      CFG,
      [dailyHabit],
      logs,
      [weekdayBlock],
      completions,
      new Date(2026, 7, 10),
    );
    // 3 habit days + 1 weekday-block day (only Mon) = 4 applicable, all done
    expect(r.applicable).toBe(4);
    expect(r.completed).toBe(4);
    expect(r.pct).toBe(1);
  });

  it("counts a miss correctly and excludes the block on a day it doesn't apply", () => {
    // Same 3-day window, but the habit was skipped on Aug 9 (Sun).
    const logs: HabitLog[] = [
      { habitId: "h1", date: "2026-08-08" },
      { habitId: "h1", date: "2026-08-10" },
    ];
    const r = computeAdherence(CFG, [dailyHabit], logs, [weekdayBlock], {}, new Date(2026, 7, 10));
    expect(r.applicable).toBe(4); // 3 habit-days + 1 weekday-block day
    expect(r.completed).toBe(2); // habit done twice, block never logged
    expect(r.pct).toBe(0.5);
  });

  it("ignores a disabled template and an archived habit", () => {
    const archived: Habit = { ...dailyHabit, id: "h2", archived: true };
    const disabled: RecurringTemplate = { ...weekdayBlock, id: "t2", enabled: false };
    const r = computeAdherence(
      CFG,
      [dailyHabit, archived],
      [{ habitId: "h1", date: "2026-08-08" }],
      [weekdayBlock, disabled],
      {},
      new Date(2026, 7, 8),
    );
    // Only h1 (daily, not archived) applies on Aug 8 (Sat) — weekdayBlock doesn't apply on Saturday.
    expect(r.applicable).toBe(1);
    expect(r.completed).toBe(1);
  });

  it("returns 0 applicable (not NaN) when there's no routine at all", () => {
    const r = computeAdherence(CFG, [], [], [], {}, new Date(2026, 7, 8));
    expect(r).toEqual({ pct: 0, completed: 0, applicable: 0 });
  });
});
