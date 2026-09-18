import { describe, it, expect } from "vitest";
import {
  isCompleteForPeriod,
  currentStreakFor,
  longestStreakFor,
  periodsSinceLast,
  toggleHabitForToday,
  buildRecovery,
} from "@/lib/habits";
import { computeHabitStats, monthCells } from "@/lib/habitStats";
import type { Habit, HabitLog } from "@/lib/habits";

function autoHabit(createdAt: Date, patch: Partial<Habit> = {}): Habit {
  return { id: "h1", title: "No smoking", cadence: "daily", createdAt: createdAt.getTime(), habitMode: "auto", ...patch };
}

const CREATED = new Date(2026, 5, 1); // Jun 1 2026
const TODAY = new Date(2026, 5, 15, 12, 0, 0); // Jun 15 2026

describe("auto-mode habits — presumed done until marked missed", () => {
  it("is complete with zero logs at all (nothing has ever been marked missed)", () => {
    const habit = autoHabit(CREATED);
    expect(isCompleteForPeriod(habit, [], TODAY)).toBe(true);
    expect(currentStreakFor(habit, [], TODAY)).toBe(15); // Jun 1..15 inclusive
  });

  it("is not complete for a period with an explicit missed log", () => {
    const habit = autoHabit(CREATED);
    const logs: HabitLog[] = [{ habitId: "h1", date: "2026-06-10", missed: true }];
    expect(isCompleteForPeriod(habit, logs, new Date(2026, 5, 10))).toBe(false);
    expect(isCompleteForPeriod(habit, logs, new Date(2026, 5, 11))).toBe(true);
  });

  it("was never tracked before the habit's creation date", () => {
    const habit = autoHabit(CREATED);
    expect(isCompleteForPeriod(habit, [], new Date(2026, 4, 20))).toBe(false);
  });

  it("current streak resets to 0 the moment a day is marked missed (no pending grace — it was a deliberate action), and resumes counting after", () => {
    const habit = autoHabit(CREATED);
    const logs: HabitLog[] = [{ habitId: "h1", date: "2026-06-10", missed: true }];
    // Jun 10 marked missed; streak on Jun 10 itself is 0 immediately.
    expect(currentStreakFor(habit, logs, new Date(2026, 5, 10, 12))).toBe(0);
    // By Jun 15, streak counts Jun 11-15 (5 days) since the miss.
    expect(currentStreakFor(habit, logs, TODAY)).toBe(5);
  });

  it("longest streak accounts for a miss splitting the run", () => {
    const habit = autoHabit(CREATED);
    const logs: HabitLog[] = [{ habitId: "h1", date: "2026-06-08", missed: true }];
    // Jun 1-7 = 7 days done, Jun 8 missed, Jun 9-15 = 7 days done (current).
    expect(longestStreakFor(habit, logs, TODAY)).toBe(7);
    expect(currentStreakFor(habit, logs, TODAY)).toBe(7);
  });

  it("toggling today marks it missed, and toggling again clears the miss", () => {
    const habit = autoHabit(CREATED);
    const first = toggleHabitForToday(habit, [], TODAY);
    expect(first.nowComplete).toBe(false);
    expect(first.logs).toEqual([{ habitId: "h1", date: "2026-06-15", missed: true }]);

    const second = toggleHabitForToday(habit, first.logs, TODAY);
    expect(second.nowComplete).toBe(true);
    expect(second.logs).toEqual([]);
  });

  it("periodsSinceLast is 0 when nothing has ever been missed", () => {
    const habit = autoHabit(CREATED);
    expect(periodsSinceLast(habit, [], TODAY)).toBe(0);
  });

  it("a single past miss doesn't linger — today is presumed fine by default, so no recovery nagging", () => {
    const habit = autoHabit(CREATED);
    // Never marked missed at all — nothing to recover from.
    expect(buildRecovery(habit, [], TODAY)).toBeNull();

    // Yesterday (Jun 14) was marked missed, but today is untouched — and for
    // an auto-mode habit, untouched means presumed fine. Auto-mode's grace
    // IS the default; there's no separate "go tick it" action required, so
    // recovery correctly stays quiet here.
    const logs: HabitLog[] = [{ habitId: "h1", date: "2026-06-14", missed: true }];
    expect(buildRecovery(habit, logs, TODAY)).toBeNull();
  });

  it("recovery does kick in while the miss is still active today (yesterday and today both marked missed)", () => {
    const habit = autoHabit(CREATED);
    const logs: HabitLog[] = [
      { habitId: "h1", date: "2026-06-14", missed: true },
      { habitId: "h1", date: "2026-06-15", missed: true }, // today, still unresolved
    ];
    const recovery = buildRecovery(habit, logs, TODAY);
    expect(recovery).not.toBeNull();
    expect(recovery!.missedPeriods).toBe(1);
  });

  it("marking today missed doesn't nag until tomorrow (today is never a miss on its own)", () => {
    const habit = autoHabit(CREATED);
    const logs: HabitLog[] = [{ habitId: "h1", date: "2026-06-15", missed: true }];
    expect(buildRecovery(habit, logs, TODAY)).toBeNull();
  });
});

describe("auto-mode habits — stats and calendar", () => {
  it("computeHabitStats treats an unmarked history as fully completed", () => {
    const habit = autoHabit(CREATED);
    const s = computeHabitStats(habit, [], {}, TODAY);
    expect(s.current).toBe(15);
    expect(s.totalMisses).toBe(0);
    // Jun 1 (start) .. Jun 15 (today) inclusive = 15 days, none missed.
    expect(s.totalCompleted).toBe(15);
  });

  it("computeHabitStats subtracts explicit misses from totalCompleted", () => {
    const habit = autoHabit(CREATED);
    const logs: HabitLog[] = [
      { habitId: "h1", date: "2026-06-05", missed: true },
      { habitId: "h1", date: "2026-06-06", missed: true },
    ];
    const s = computeHabitStats(habit, logs, {}, TODAY);
    expect(s.totalCompleted).toBe(13); // 15 elapsed - 2 missed
    expect(s.totalMisses).toBe(2);
  });

  it("monthCells marks unmarked days done and explicitly-missed days missed", () => {
    const habit = autoHabit(CREATED);
    const logs: HabitLog[] = [{ habitId: "h1", date: "2026-06-08", missed: true }];
    const cells = monthCells(habit, logs, {}, 2026, 5, TODAY);
    const at = (d: string) => cells.find((c) => c.ymd === d)!;
    expect(at("2026-06-07").state).toBe("done");
    expect(at("2026-06-08").state).toBe("missed");
    expect(at("2026-06-15").state).toBe("done"); // today, unmarked — presumed done
    expect(at("2026-06-20").state).toBe("future");
  });

  it("monthCells does not mark days before the habit's creation as missed", () => {
    const habit = autoHabit(CREATED);
    const cells = monthCells(habit, [], {}, 2026, 4, TODAY); // May 2026
    const may20 = cells.find((c) => c.ymd === "2026-05-20")!;
    expect(may20.state).not.toBe("missed");
    expect(may20.state).toBe("none");
  });
});
