// Analytics helpers for goal tracking — streak stats, quarter labelling, daily logs.

import type { Goal, DailyEntry, RelapseEntry } from "./goals";
import { quarterFromDate } from "./goals";

/* ---------- Deadline / quarter helpers ---------- */

/**
 * Deadlines reach us in two shapes: a plain "2026-12-31" (seeds, imports) and a
 * full ISO timestamp (the in-app date picker calls toISOString()). Normalise
 * both to local midnight on the intended calendar day.
 *
 * Both halves matter. Appending a time to a full ISO string yields an Invalid
 * Date, and reading a date-only string as UTC lands on the previous day for
 * anyone west of Greenwich.
 */
export function parseDeadline(deadline: string | undefined): Date | null {
  if (!deadline) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(deadline)
    ? new Date(`${deadline}T00:00:00`)
    : new Date(deadline);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** "2026-12-31" → "Q4 2026" */
export function deadlineQuarterLabel(deadline: string | undefined): string | null {
  const d = parseDeadline(deadline);
  if (!d) return null;
  return `${quarterFromDate(d)} ${d.getFullYear()}`;
}

/** Days remaining until a deadline, counting the deadline day itself as available. */
export function daysToDeadline(deadline: string | undefined, now = new Date()): number | null {
  const d = parseDeadline(deadline);
  if (!d) return null;
  const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return Math.ceil((endOfDay.getTime() - now.getTime()) / 86_400_000);
}

/** Weeks remaining until deadline. */
export function weeksToDeadline(deadline: string | undefined, now = new Date()): number | null {
  const d = daysToDeadline(deadline, now);
  return d === null ? null : Math.max(0, Math.ceil(d / 7));
}

/**
 * For metric goals: how much per week is needed to hit target by deadline.
 * Returns null when inputs are insufficient.
 */
export function requiredWeeklyRate(goal: Goal, now = new Date()): number | null {
  if (!goal.target || !goal.deadline) return null;
  const days = daysToDeadline(goal.deadline, now);
  if (days === null || days <= 0) return null;
  const remaining = goal.target - (goal.current ?? 0);
  if (remaining <= 0) return 0;
  // Divide by exact days/7, not whole weeks — rounding weeks up here made this
  // disagree with the daily rate shown elsewhere on the same goal.
  return remaining / (days / 7);
}

/* ---------- Payoff / contribution pace ---------- */

const DAYS_PER_MONTH = 365.25 / 12;

export interface PayoffPace {
  /** Still to pay off (debt) or still to put away (savings). */
  remaining: number;
  daysLeft: number;
  /** What clearing `remaining` by the deadline costs at each cadence. */
  perDay: number;
  perWeek: number;
  perMonth: number;
  /** Rounded whole months left — for "over the next N months" copy. */
  monthsLeft: number;
}

/**
 * What it takes, per day / week / month, to close the gap on a money goal by
 * its deadline. A balance is a number you can't act on; "$208 a week" is.
 *
 * Returns null when there's nothing left to pay, no deadline to pace against,
 * or the deadline has already passed — the UI asks for a deadline instead of
 * inventing one.
 */
export function payoffPace(goal: Goal, now = new Date()): PayoffPace | null {
  const target = goal.target ?? 0;
  if (target <= 0) return null;
  const remaining = target - (goal.current ?? 0);
  if (remaining <= 0) return null;

  const daysLeft = daysToDeadline(goal.deadline, now);
  if (daysLeft === null || daysLeft <= 0) return null;

  return {
    remaining,
    daysLeft,
    perDay: remaining / daysLeft,
    perWeek: remaining / (daysLeft / 7),
    perMonth: remaining / (daysLeft / DAYS_PER_MONTH),
    monthsLeft: Math.max(1, Math.round(daysLeft / DAYS_PER_MONTH)),
  };
}

/* ---------- Streak pace ---------- */

export type StreakPaceStatus =
  | "reached"
  | "no_deadline"
  | "comfortable"
  | "tight"
  | "must_start_today"
  | "not_enough_time";

export interface StreakPace {
  /** Consecutive days still needed on top of the current streak. */
  needed: number;
  /** Calendar days until the deadline (null when there's no deadline). */
  daysLeft: number | null;
  /** Spare days: how many more times you could reset and still make it. */
  slack: number | null;
  /** The last date you could start a clean run and still finish in time. */
  latestStart: string | null;
  status: StreakPaceStatus;
  label: string;
  detail: string;
  tone: string;
}

/**
 * Pace for a streak goal, measured the only way a streak can be: consecutive
 * days still needed versus calendar days still available.
 *
 * A streak is not a cumulative rate — you can't be "1000 days behind" on a
 * 90-day streak with 128 days left. What actually matters is whether there's
 * still room to run the streak out, and how much slack you have if you slip.
 */
export function streakPace(goal: Goal, now = new Date()): StreakPace {
  const target = goal.target ?? 90;
  const currentStreak = computeStreakStats(goal).currentStreak;
  const needed = Math.max(0, target - currentStreak);
  const daysLeft = daysToDeadline(goal.deadline, now);

  const base = { needed, daysLeft, slack: null as number | null, latestStart: null as string | null };

  if (needed <= 0) {
    return {
      ...base,
      status: "reached",
      label: `${target} days reached`,
      detail: "Streak complete. Lock it in as a habit if you want it to stick.",
      tone: "text-gold",
    };
  }
  if (daysLeft === null) {
    return {
      ...base,
      status: "no_deadline",
      label: `${needed} days to go`,
      detail: `You're on day ${currentStreak} of ${target}. Set a deadline and Alfred can pace it for you.`,
      tone: "text-muted-foreground",
    };
  }

  const slack = daysLeft - needed;
  // The last day you could begin a fresh run of `needed` days and still land on
  // or before the deadline. This is the number that makes the time concrete.
  const latest = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  latest.setDate(latest.getDate() + Math.max(0, slack));
  const latestStart = todayKeyLocal(latest);
  const full = { ...base, slack, latestStart };

  if (slack < 0) {
    return {
      ...full,
      status: "not_enough_time",
      label: `${needed} days needed, ${daysLeft} left`,
      detail: `A clean ${target}-day run no longer fits before ${friendlyDate(goal.deadline!)}. Push the deadline out by ${Math.abs(slack)} day${Math.abs(slack) === 1 ? "" : "s"}, or aim at ${daysLeft} days instead — either is a fair adjustment, not a failure.`,
      tone: "text-destructive",
    };
  }
  if (slack === 0) {
    return {
      ...full,
      status: "must_start_today",
      label: `${needed} days needed, ${daysLeft} left`,
      detail: "It still fits — but only if every remaining day counts from today.",
      tone: "text-orange-400",
    };
  }
  if (slack <= Math.max(3, Math.round(needed * 0.1))) {
    return {
      ...full,
      status: "tight",
      label: `${needed} to go · ${slack} spare day${slack === 1 ? "" : "s"}`,
      detail: `Day ${currentStreak} of ${target}. Starting fresh any later than ${friendlyDate(latestStart)} wouldn't fit.`,
      tone: "text-orange-400",
    };
  }
  return {
    ...full,
    status: "comfortable",
    label: `${needed} to go · ${slack} spare day${slack === 1 ? "" : "s"}`,
    detail: `Day ${currentStreak} of ${target}, ${daysLeft} days left. Even starting over as late as ${friendlyDate(latestStart)} still gets you there.`,
    tone: "text-teal",
  };
}

/** Local YYYY-MM-DD — toISOString() would shift the date in western timezones. */
function todayKeyLocal(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** "2026-10-06" → "Oct 6" — a date a person can picture. */
function friendlyDate(iso: string): string {
  const d = parseDeadline(iso);
  if (!d) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
