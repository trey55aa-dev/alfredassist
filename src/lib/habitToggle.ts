// One place for "the user ticked a habit today".
//
// Ticking a habit isn't just a log write — it records the completion time
// (hour-of-day stats), awards XP with the habit's own streak, and moves any
// linked 2026 goal. That flow lived only in the Checklist, so the same tap
// from the Dashboard or the challenge card did less. This centralises it so
// every surface behaves identically.

import { todayKey } from "./alfred";
import {
  type Habit,
  type HabitLog,
  currentStreakFor,
  isCompleteForPeriod,
  recordHabitTime,
  removeHabitTime,
  toggleHabitForToday,
} from "./habits";
import type { Goal } from "./goals";
import { awardXp, XP_VALUES } from "./gamification";

export interface HabitToggleResult {
  logs: HabitLog[];
  goals: Goal[];
  nowComplete: boolean;
}

/**
 * Toggle `habit` for today and return the next logs + goals. Side effects
 * (completion time, XP) are applied here; the caller persists what's returned.
 */
export function applyHabitToggle(
  habit: Habit,
  logs: HabitLog[],
  goals: Goal[],
): HabitToggleResult {
  const wasDone = isCompleteForPeriod(habit, logs);
  const { logs: nextLogs, nowComplete } = toggleHabitForToday(habit, logs);

  // Completion time powers the hour-of-day stats; clear it on untick.
  if (nowComplete && !wasDone) recordHabitTime(habit.id, todayKey());
  else if (!nowComplete && wasDone) removeHabitTime(habit.id, todayKey());

  if (nowComplete && !wasDone) {
    awardXp(XP_VALUES.HABIT_COMPLETE, "habit", {
      streakDays: currentStreakFor(habit, nextLogs),
    });
  }

  // A habit wired to a goal moves that goal both ways.
  let nextGoals = goals;
  if (habit.goalId && nowComplete !== wasDone) {
    const inc = habit.goalIncrement ?? 1;
    const now = Date.now();
    nextGoals = goals.map((g) => {
      if (g.id !== habit.goalId) return g;
      const current = g.current ?? 0;
      const next = nowComplete
        ? typeof g.target === "number"
          ? Math.min(g.target, current + inc)
          : current + inc
        : Math.max(0, current - inc);
      return { ...g, current: next, localUpdatedAt: now };
    });
  }

  return { logs: nextLogs, goals: nextGoals, nowComplete };
}
