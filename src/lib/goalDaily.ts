// Derives a daily to-do list from the 2026 goals: each active goal becomes a
// "work on it today" item with on-pace guidance. The daily done-state is tracked
// in its own local store (NOT goal.progressLog, which the dashboard auto-stamps).

import type { Goal } from "./goals";
import { computeProjection, fmtUnits } from "./goalsHistory";
import { todayKey } from "./alfred";

export const GOAL_DAILY_KEY = "alfred.goalDaily.done";

function load(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(GOAL_DAILY_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function save(map: Record<string, boolean>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GOAL_DAILY_KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

function dayKey(goalId: string, date: string): string {
  return `${goalId}|${date}`;
}

export function isGoalDoneToday(goalId: string, date = todayKey()): boolean {
  return !!load()[dayKey(goalId, date)];
}

export function setGoalDoneToday(goalId: string, done: boolean, date = todayKey()): void {
  const map = load();
  if (done) map[dayKey(goalId, date)] = true;
  else delete map[dayKey(goalId, date)];
  save(map);
}

export function goalsDoneTodayCount(goalIds: string[], date = todayKey()): number {
  const map = load();
  return goalIds.reduce((n, id) => (map[dayKey(id, date)] ? n + 1 : n), 0);
}

/**
 * A round, whole-unit amount to log per day to stay on pace — or null when a
 * daily numeric nudge doesn't make sense (sub-unit rate, no target, streak).
 * Used for the optional "+N" quick-log button.
 */
export function dailyPaceAmount(goal: Goal): number | null {
  if (goal.goalType === "streak") return null;
  if (typeof goal.target !== "number" || goal.target <= 0) return null;
  const r = computeProjection(goal).requiredDailyRate;
  if (r == null || !isFinite(r) || r < 1) return null;
  return Math.round(r);
}

/** Human pace guidance line for a goal's daily row, or null. */
export function paceHint(goal: Goal): string | null {
  if (goal.goalType === "streak") return "keep the streak alive";
  if (typeof goal.target !== "number" || goal.target <= 0) return null;
  const r = computeProjection(goal).requiredDailyRate;
  if (r == null || !isFinite(r) || r <= 0) return null;

  const money = goal.unit === "$";
  if (r >= 1) {
    const v = Math.round(r);
    return money
      ? `$${v.toLocaleString()}/day to stay on pace`
      : `${fmtUnits(v, goal.unit)}/day to stay on pace`;
  }
  const w = Math.max(1, Math.round(r * 7));
  return money
    ? `$${w.toLocaleString()}/wk to stay on pace`
    : `${fmtUnits(w, goal.unit)}/wk to stay on pace`;
}

/** Order active goals so the actionable ones (pace/streak) come first. */
export function sortForDaily(goals: Goal[]): Goal[] {
  const rank = (g: Goal) => {
    if (g.goalType === "streak") return 0;
    if (typeof g.target === "number" && g.target > 0) return 1;
    return 2;
  };
  return [...goals].sort((a, b) => rank(a) - rank(b));
}
