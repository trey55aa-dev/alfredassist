// Analytics helpers for goal tracking — streak stats, quarter labelling, daily logs.

import type { Goal, DailyEntry, RelapseEntry } from "./goals";
import { quarterFromDate } from "./goals";

/* ---------- Deadline / quarter helpers ---------- */

/** "2026-12-31" → "Q4 2026" */
export function deadlineQuarterLabel(deadline: string | undefined): string | null {
  if (!deadline) return null;
  const d = new Date(deadline + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return `${quarterFromDate(d)} ${d.getFullYear()}`;
}

/** Days remaining until a deadline ISO string, or null. */
export function daysToDeadline(deadline: string | undefined): number | null {
  if (!deadline) return null;
  const ms = new Date(deadline + "T23:59:59").getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

/** Weeks remaining until deadline. */
export function weeksToDeadline(deadline: string | undefined): number | null {
  const d = daysToDeadline(deadline);
  return d === null ? null : Math.max(0, Math.ceil(d / 7));
}

/**
 * For metric goals: how much per week is needed to hit target by deadline.
 * Returns null when inputs are insufficient.
 */
export function requiredWeeklyRate(goal: Goal): number | null {
  if (!goal.target || !goal.deadline) return null;
  const weeks = weeksToDeadline(goal.deadline);
  if (weeks === null || weeks <= 0) return null;
  const remaining = goal.target - (goal.current ?? 0);
  if (remaining <= 0) return 0;
  return remaining / weeks;
}

/* ---------- Streak helpers ---------- */

export interface StreakStats {
  currentStreak: number;
  bestStreak: number;
  totalDone: number;
  totalMissed: number;
  /** Is it still mathematically possible to hit the target before deadline? */
  isAchievable: boolean;
  /** YYYY-MM-DD of the last done entry, or null. */
  lastDone: string | null;
  /** Whether today is already logged (either done or missed). */
  todayLogged: boolean;
}

export function computeStreakStats(goal: Goal): StreakStats {
  const log = goal.dailyLog ?? {};
  const relapses = goal.relapseLog ?? [];
  const target = goal.target ?? 90;

  // Build a sorted list of all dates in the log
  const allDates = Object.keys(log).sort();
  const todayStr = new Date().toISOString().slice(0, 10);

  const todayEntry = log[todayStr];
  const todayLogged = todayEntry !== undefined || relapses.some((r) => r.date === todayStr);

  // Total done / missed from dailyLog
  let totalDone = 0;
  let totalMissed = 0;
  for (const entry of Object.values(log)) {
    if (entry.done) totalDone++;
    else totalMissed++;
  }
  // Relapses not in dailyLog also count as misses
  for (const r of relapses) {
    if (!log[r.date]) totalMissed++;
  }

  // Build done-day set
  const doneSet = new Set<string>(allDates.filter((d) => log[d].done));
  // Remove days that appear in relapseLog (relapse overrides)
  for (const r of relapses) doneSet.delete(r.date);

  // Current streak — consecutive done days ending today (or yesterday)
  let cursor = doneSet.has(todayStr) ? todayStr : yyyyMmDdOffset(todayStr, -1);
  let currentStreak = 0;
  while (doneSet.has(cursor)) {
    currentStreak++;
    cursor = yyyyMmDdOffset(cursor, -1);
  }

  // Best streak — scan all done dates chronologically
  const doneSorted = Array.from(doneSet).sort();
  let bestStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of doneSorted) {
    if (prev && yyyyMmDdOffset(prev, 1) === d) {
      run++;
    } else {
      run = 1;
    }
    if (run > bestStreak) bestStreak = run;
    prev = d;
  }
  bestStreak = Math.max(bestStreak, currentStreak);

  // Is achievable? Need `target - currentStreak` more consecutive days before deadline.
  const daysLeft = daysToDeadline(goal.deadline);
  const needed = target - currentStreak;
  const isAchievable =
    needed <= 0 || (daysLeft !== null && daysLeft >= needed);

  const lastDone =
    doneSorted.length > 0 ? doneSorted[doneSorted.length - 1] : null;

  return {
    currentStreak,
    bestStreak,
    totalDone,
    totalMissed,
    isAchievable,
    lastDone,
    todayLogged,
  };
}

/** Log a day as done for a streak goal. Returns updated goal. */
export function logStreakDay(goal: Goal, date: string, time: string): Goal {
  const entry: DailyEntry = { done: true, time };
  return {
    ...goal,
    dailyLog: { ...(goal.dailyLog ?? {}), [date]: entry },
    // Keep current synced to current streak for backward compat with metric display
    current: computeStreakStats({ ...goal, dailyLog: { ...(goal.dailyLog ?? {}), [date]: entry } }).currentStreak,
  };
}

/** Log a relapse for a streak goal. Resets streak. Returns updated goal. */
export function logRelapse(
  goal: Goal,
  date: string,
  time: string,
  reason: string,
  avoidance: string,
): Goal {
  const entry: RelapseEntry = { date, time, reason, avoidance };
  const newRelapseLog = [...(goal.relapseLog ?? []), entry];
  // Mark the day as not-done in dailyLog (ensures calendar shows it correctly)
  const newDailyLog = { ...(goal.dailyLog ?? {}), [date]: { done: false } as DailyEntry };
  return {
    ...goal,
    dailyLog: newDailyLog,
    relapseLog: newRelapseLog,
    current: computeStreakStats({ ...goal, dailyLog: newDailyLog, relapseLog: newRelapseLog }).currentStreak,
  };
}

/* ---------- Calendar grid ---------- */

export type DayStatus = "done" | "relapse" | "empty";

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  status: DayStatus;
  time?: string;
  isFuture: boolean;
  isToday: boolean;
}

/** Returns last `days` calendar days (oldest first) with status for heatmap rendering. */
export function getCompletionGrid(goal: Goal, days = 35): CalendarDay[] {
  const log = goal.dailyLog ?? {};
  const relapseSet = new Set((goal.relapseLog ?? []).map((r) => r.date));
  const todayStr = new Date().toISOString().slice(0, 10);

  const out: CalendarDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = yyyyMmDdOffset(todayStr, -i);
    const isToday = d === todayStr;
    const isFuture = d > todayStr;
    let status: DayStatus = "empty";
    if (!isFuture) {
      const entry = log[d];
      if (relapseSet.has(d) || (entry && !entry.done)) status = "relapse";
      else if (entry?.done) status = "done";
    }
    out.push({ date: d, status, time: log[d]?.time, isFuture, isToday });
  }
  return out;
}

/* ---------- Utils ---------- */

function yyyyMmDdOffset(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
