import { describe, it, expect } from "vitest";
import { computeHabitStats, monthCells, yearHeatmap, ymd } from "@/lib/habitStats";
import type { Habit, HabitLog } from "@/lib/habits";

function dailyHabit(createdAt: Date): Habit {
  return { id: "h1", title: "Run", cadence: "daily", createdAt: createdAt.getTime() };
}

// A daily habit created Jun 1 2026, done Jun 1–14 EXCEPT Jun 8 (one miss).
// "Today" is Jun 15 (not yet logged).
const CREATED = new Date(2026, 5, 1);
const TODAY = new Date(2026, 5, 15, 12, 0, 0);

function seedLogs(): HabitLog[] {
  const logs: HabitLog[] = [];
  for (let d = 1; d <= 14; d++) {
    if (d === 8) continue; // the miss
    logs.push({ habitId: "h1", date: `2026-06-${String(d).padStart(2, "0")}` });
  }
  return logs;
}

describe("computeHabitStats", () => {
  const stats = computeHabitStats(dailyHabit(CREATED), seedLogs(), {}, TODAY);

  it("counts the single miss and pins it to the right weekday", () => {
    expect(stats.totalMisses).toBe(1);
    expect(stats.worstWeekday).toBe(new Date("2026-06-08T00:00:00").getDay());
  });

  it("computes current and best streaks correctly across the gap", () => {
    // Jun 9–14 done, today pending → current = 6. Jun 1–7 = 7 → best = 7.
    expect(stats.current).toBe(6);
    expect(stats.longest).toBe(7);
  });

  it("computes rolling windows and totals", () => {
    // last 7 days = Jun 9–15; done on 9–14 (6), 15 pending.
    expect(stats.last7Done).toBe(6);
    expect(stats.totalCompleted).toBe(13);
  });

  it("computes this-year completion from the tracking start", () => {
    // yearStart = Jun 1 (after Jan 1); elapsed Jun 1–15 = 15 days; 13 done.
    expect(stats.yearElapsed).toBe(15);
    expect(stats.yearDone).toBe(13);
    expect(stats.yearPct).toBe(Math.round((13 / 15) * 100));
  });

  it("builds an hour histogram + peak from recorded completion times", () => {
    const at7 = new Date(2026, 5, 9, 7, 30).getTime();
    const at7b = new Date(2026, 5, 10, 7, 15).getTime();
    const at21 = new Date(2026, 5, 11, 21, 0).getTime();
    const times = { "h1|2026-06-09": at7, "h1|2026-06-10": at7b, "h1|2026-06-11": at21 };
    const s = computeHabitStats(dailyHabit(CREATED), seedLogs(), times, TODAY);
    expect(s.timedCount).toBe(3);
    expect(s.peakHour).toBe(7);
    expect(s.hourHist[7]).toBe(2);
    expect(s.hourHist[21]).toBe(1);
  });
});

describe("monthCells", () => {
  const cells = monthCells(dailyHabit(CREATED), seedLogs(), {}, 2026, 5, TODAY);

  it("returns a 42-cell (6-week) grid", () => {
    expect(cells).toHaveLength(42);
  });

  it("marks done / missed / today / future correctly", () => {
    const at = (d: string) => cells.find((c) => c.ymd === d)!;
    expect(at("2026-06-09").state).toBe("done");
    expect(at("2026-06-08").state).toBe("missed");
    expect(at("2026-06-15").state).toBe("today");
    expect(at("2026-06-20").state).toBe("future");
  });

  it("does not mark days before tracking began as missed", () => {
    // May 31 is in the leading padding, before createdAt → not a 'missed'.
    const may31 = cells.find((c) => c.ymd === "2026-05-31");
    expect(may31).toBeTruthy();
    expect(may31!.state).not.toBe("missed");
  });
});

describe("yearHeatmap", () => {
  const heat = yearHeatmap(dailyHabit(CREATED), seedLogs(), TODAY);

  it("counts total completions in the trailing window, matching totalCompleted", () => {
    // Same 13 done days as computeHabitStats.totalCompleted — all within the last 365 days.
    expect(heat.totalDone).toBe(13);
  });

  it("lays out Sunday-aligned weeks, each starting on a Sunday, up to today", () => {
    // Every week but the last (which stops at today, not necessarily a Saturday) is full.
    for (const week of heat.weeks.slice(0, -1)) {
      expect(week).toHaveLength(7);
      expect(week[0].date.getDay()).toBe(0); // Sunday
    }
    const last = heat.weeks[heat.weeks.length - 1];
    expect(last[0].date.getDay()).toBe(0);
    expect(last[last.length - 1].ymd).toBe(ymd(TODAY));
  });

  it("marks the completed days done and pre-tracking days out of range", () => {
    const flat = heat.weeks.flat();
    const at = (d: string) => flat.find((c) => c.ymd === d)!;
    expect(at("2026-06-09").done).toBe(true);
    expect(at("2026-06-08").done).toBe(false);
    // May 31 is before the habit's createdAt (Jun 1) — out of range, not a false "miss".
    expect(at("2026-05-31").inRange).toBe(false);
  });

  it("respects a custom window size", () => {
    const short = yearHeatmap(dailyHabit(CREATED), seedLogs(), TODAY, 7);
    // 7-day window starting Jun 9, Sunday-aligned back to Jun 7 → still counts only real logs.
    expect(short.totalDone).toBe(6); // Jun 9–14 done, Jun 15 (today) not yet
  });
});

describe("ymd", () => {
  it("formats local dates as YYYY-MM-DD", () => {
    expect(ymd(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(ymd(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});
