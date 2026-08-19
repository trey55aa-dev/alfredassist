import { describe, it, expect } from "vitest";
import { buildRecovery, habitsAtRisk } from "@/lib/habits";
import type { Habit, HabitLog } from "@/lib/habits";

function dailyHabit(id: string, title: string, createdAt: Date): Habit {
  return { id, title, cadence: "daily", createdAt: createdAt.getTime() };
}

// "Today" is Aug 18 2026, still in progress (grace before penalty: today is
// never a miss on its own).
const TODAY = new Date(2026, 7, 18, 10, 0, 0);
const CREATED = new Date(2026, 6, 1);

describe("buildRecovery — grace before penalty", () => {
  it("does not flag a habit that was completed yesterday but not yet today", () => {
    const habit = dailyHabit("h1", "Meditate", CREATED);
    const logs: HabitLog[] = [{ habitId: "h1", date: "2026-08-17" }];
    expect(buildRecovery(habit, logs, TODAY)).toBeNull();
  });

  it("flags a habit whose last fully-elapsed period (yesterday) was missed, and says so accurately", () => {
    const habit = dailyHabit("h1", "Meditate", CREATED);
    // Last done two days ago; yesterday was genuinely skipped.
    const logs: HabitLog[] = [{ habitId: "h1", date: "2026-08-16" }];
    const recovery = buildRecovery(habit, logs, TODAY);
    expect(recovery).not.toBeNull();
    expect(recovery!.missedPeriods).toBe(1);
    expect(recovery!.flavor).toContain("slipped yesterday");
  });

  it("counts only fully-elapsed missed days, not the still-open current day", () => {
    const habit = dailyHabit("h3", "Journal", CREATED);
    // Last done 2026-08-10; nothing logged since, including today.
    const logs: HabitLog[] = [{ habitId: "h3", date: "2026-08-10" }];
    const recovery = buildRecovery(habit, logs, TODAY);
    expect(recovery).not.toBeNull();
    // 08-11..08-17 are the 7 fully-elapsed days without Journal; today (08-18) doesn't count yet.
    expect(recovery!.missedPeriods).toBe(7);
  });

  it("stops nagging once a new streak has started, even after a long gap", () => {
    const habit = dailyHabit("h1", "Meditate", CREATED);
    // Missed Aug 11-17 outright, but picked it back up TODAY (Aug 18).
    const logs: HabitLog[] = [{ habitId: "h1", date: "2026-08-10" }, { habitId: "h1", date: "2026-08-18" }];
    expect(buildRecovery(habit, logs, TODAY)).toBeNull();
  });

  it("keeps flagging a lapsed habit that has not been picked back up today", () => {
    const habit = dailyHabit("h1", "Meditate", CREATED);
    const logs: HabitLog[] = [{ habitId: "h1", date: "2026-08-10" }];
    expect(buildRecovery(habit, logs, TODAY)).not.toBeNull();
  });

  it("still coaches onboarding for a habit never done at all", () => {
    const habit = dailyHabit("h4", "Stretch", CREATED);
    const recovery = buildRecovery(habit, [], TODAY);
    expect(recovery).not.toBeNull();
    expect(recovery!.missedPeriods).toBe(1);
  });
});

describe("habitsAtRisk — grace before penalty", () => {
  it("excludes habits done yesterday even if not yet done today, includes genuinely overdue ones", () => {
    const habits: Habit[] = [
      dailyHabit("h1", "Meditate", CREATED),
      dailyHabit("h2", "Drink water", CREATED),
      dailyHabit("h3", "Journal", CREATED),
    ];
    const logs: HabitLog[] = [
      { habitId: "h1", date: "2026-08-17" },
      { habitId: "h2", date: "2026-08-17" },
      { habitId: "h3", date: "2026-08-10" },
    ];
    const atRisk = habitsAtRisk(habits, logs, TODAY);
    expect(atRisk.map((r) => r.habit.id)).toEqual(["h3"]);
  });

  it("drops a habit from the list the moment it is ticked today", () => {
    const habits: Habit[] = [dailyHabit("h3", "Journal", CREATED)];
    const lapsed: HabitLog[] = [{ habitId: "h3", date: "2026-08-10" }];
    expect(habitsAtRisk(habits, lapsed, TODAY)).toHaveLength(1);

    const pickedBackUp = [...lapsed, { habitId: "h3", date: "2026-08-18" }];
    expect(habitsAtRisk(habits, pickedBackUp, TODAY)).toHaveLength(0);
  });
});
