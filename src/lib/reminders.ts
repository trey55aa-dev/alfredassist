// Decision logic for the daily reminder nudges — pure, reads localStorage, no
// delivery side-effects (the hook calls notifyDailyNudge when these say "due").
// Kept separate so the conditions are easy to reason about and test.

import { todayKey } from "./alfred";
import {
  HABITS_KEY,
  HABIT_LOGS_KEY,
  isCompleteForPeriod,
  type Habit,
  type HabitLog,
} from "./habits";
import { GOALS_KEY, type Goal } from "./goals";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Evening streak-at-risk: after 7pm with daily habits still unchecked. */
export function streakAtRisk(now = new Date()): { due: boolean; remaining: number } {
  const habits = read<Habit[]>(HABITS_KEY, []).filter(
    (h) => !h.archived && h.cadence === "daily",
  );
  if (habits.length === 0) return { due: false, remaining: 0 };
  const logs = read<HabitLog[]>(HABIT_LOGS_KEY, []);
  const done = habits.filter((h) => isCompleteForPeriod(h, logs)).length;
  const remaining = habits.length - done;
  return { due: now.getHours() >= 19 && remaining > 0, remaining };
}

/** Afternoon goal check-in: midday–evening with measurable goals not yet logged today. */
export function goalCheckInDue(now = new Date()): { due: boolean; count: number } {
  const goals = read<Goal[]>(GOALS_KEY, []);
  const today = todayKey();
  const pending = goals.filter(
    (g) =>
      !g.done &&
      typeof g.target === "number" &&
      (g.target ?? 0) > 0 &&
      (g.progressLog ?? {})[today] === undefined,
  );
  const hour = now.getHours();
  return { due: hour >= 12 && hour < 22 && pending.length > 0, count: pending.length };
}
