// Daily + weekly progress history and projection for goals.
//
// A "check-in" stamps a YYYY-MM-DD key in goal.progressLog with the post-bump
// current value, and updates goal.lastCheckIn.
//
// lastNWeeks() aggregates that same log by calendar week (Mon–Sun) so the UI
// can display a rate-vs-required bar chart alongside the 14-day dot grid.
//
// computeProjection() compares your actual rate against the rate you need to
// hit the deadline, and exposes requiredDailyRate, weeksLeft, and daysLeft so
// the UI can render "Need $288/wk · 26 weeks left" style rate headlines.

import type { Goal } from "./goals";
import { todayKey } from "./alfred";

/* ---------- logging ---------- */

export interface LogTodayArgs {
  goal: Goal;
  /** Amount to add to goal.current. Defaults to 1. */
  delta?: number;
  /** Explicit absolute value override (sets current to this). Wins over delta. */
  setTo?: number;
  /** ISO date YYYY-MM-DD. Defaults to today (local). */
  date?: string;
}

/** Pure: returns a new Goal with progressLog + current updated for the given day. */
export function logProgress({ goal, delta = 1, setTo, date }: LogTodayArgs): Goal {
  const day = date ?? todayKey();
  const log = { ...(goal.progressLog ?? {}) };
  const prev = goal.current ?? 0;
  let next = setTo !== undefined ? setTo : prev + delta;
  if (Number.isNaN(next)) next = prev;
  log[day] = next;
  return { ...goal, current: next, progressLog: log, lastCheckIn: day };
}

/* ---------- last 14 days grid ---------- */

export interface DaySnapshot {
  date: string; // YYYY-MM-DD
  /** Was there a check-in entry that day? */
  logged: boolean;
  /** Increase in current vs the previous logged day (0 if none). */
  delta: number;
  /** Absolute current value as of that day's entry (or the prior known value). */
  value: number;
}

/** Returns the most recent N days oldest->newest, with logged/delta/value for each. */
export function last14Days(goal: Goal, today = new Date(), n = 14): DaySnapshot[] {
  const log = goal.progressLog ?? {};
  const out: DaySnapshot[] = [];
  let running = 0;
  // Walk forward from N-1 days ago up to today
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = todayKey(d);
    const v = log[key];
    if (v !== undefined) {
      const delta = v - running; // can be negative (setback/spend)
      out.push({ date: key, logged: true, delta, value: v });
      running = v;
    } else {
      out.push({ date: key, logged: false, delta: 0, value: running });
    }
  }
  return out;
}

/* ---------- weekly aggregation ---------- */

export interface WeekSnapshot {
  /** Monday of the week, YYYY-MM-DD */
  weekStart: string;
  /** Sunday of the week, YYYY-MM-DD */
  weekEnd: string;
  /** Human label: "Jun 2" (first day) */
  label: string;
  /** True for the calendar week that contains today */
  isCurrentWeek: boolean;
  /** Any log entry exists this week */
  logged: boolean;
  /** Net change during the week (can be negative) */
  delta: number;
  /** Running value at end of week (carry-forward when no entries) */
  endValue: number;
  /** How many individual days had entries this week */
  daysLogged: number;
}

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/**
 * Returns the most recent n calendar weeks (Mon–Sun), oldest first.
 * Each snapshot shows the *net change* logged during that week,
 * derived from the absolute values in goal.progressLog.
 */
export function lastNWeeks(goal: Goal, today = new Date(), n = 8): WeekSnapshot[] {
  const log = goal.progressLog ?? {};

  // Monday of the current week
  const dow = today.getDay(); // 0=Sun … 6=Sat
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  monday.setHours(0, 0, 0, 0);

  // Find the running value just before the oldest week we'll display
  const oldestMonday = new Date(monday);
  oldestMonday.setDate(monday.getDate() - (n - 1) * 7);
  const oldestKey = todayKey(oldestMonday);

  const priorEntries = Object.entries(log)
    .filter(([k]) => k < oldestKey)
    .sort(([a], [b]) => a.localeCompare(b));
  let runningValue: number =
    priorEntries.length > 0 ? (priorEntries[priorEntries.length - 1][1] as number) : 0;

  const todayKey_ = todayKey(today);
  const out: WeekSnapshot[] = [];

  for (let w = n - 1; w >= 0; w--) {
    const wStart = new Date(monday);
    wStart.setDate(monday.getDate() - w * 7);
    const wEnd = new Date(wStart);
    wEnd.setDate(wStart.getDate() + 6);

    const startKey = todayKey(wStart);
    const endKey = todayKey(wEnd);

    const weekStartValue = runningValue;
    let weekEndValue = runningValue;
    let daysLogged = 0;

    // Walk each day of the week; stop at today to avoid future dates
    for (let d = 0; d < 7; d++) {
      const day = new Date(wStart);
      day.setDate(wStart.getDate() + d);
      const key = todayKey(day);
      if (key > todayKey_) break;
      const v = log[key] as number | undefined;
      if (v !== undefined) {
        weekEndValue = v;
        daysLogged++;
      }
    }

    const label = `${MONTH_SHORT[wStart.getMonth()]} ${wStart.getDate()}`;

    out.push({
      weekStart: startKey,
      weekEnd: endKey,
      label,
      isCurrentWeek: w === 0,
      logged: daysLogged > 0,
      delta: weekEndValue - weekStartValue,
      endValue: weekEndValue,
      daysLogged,
    });

    runningValue = weekEndValue; // carry forward
  }

  return out;
}

/* ---------- projection ---------- */

export type ProjectionStatus =
  | "no_data"
  | "complete"
  | "ahead"
  | "on_pace"
  | "behind"
  | "behind_critical"
  | "missing";

export interface ProjectionResult {
  status: ProjectionStatus;
  /** Headline message for the goal card. */
  label: string;
  /** Optional follow-up sentence with the math. */
  detail?: string;
  /** Tailwind color class for the label. */
  tone: string;
  /** Days the goal is projected to miss by (positive = late). null if no deadline. */
  daysLate: number | null;
  /** Required units/day going forward to still hit the target. */
  requiredDailyRate: number | null;
  /** Observed units/day so far. */
  actualDailyRate: number | null;
  /** Calendar days remaining to the effective deadline. */
  daysLeft: number | null;
  /** Full calendar weeks remaining (ceil). */
  weeksLeft: number | null;
}

const MS_PER_DAY = 86_400_000;

function endOfQuarter(quarter: string | null | undefined, year: number): Date | null {
  switch (quarter) {
    case "Q1":
      return new Date(year, 2, 31, 23, 59, 59); // Mar 31
    case "Q2":
      return new Date(year, 5, 30, 23, 59, 59); // Jun 30
    case "Q3":
      return new Date(year, 8, 30, 23, 59, 59); // Sep 30
    case "Q4":
      return new Date(year, 11, 31, 23, 59, 59); // Dec 31
    default:
      return null;
  }
}

function effectiveStart(goal: Goal): Date {
  if (goal.planStartDate) return new Date(goal.planStartDate);
  if (goal.createdAt && goal.createdAt > 0) return new Date(goal.createdAt);
  return new Date();
}

function effectiveDeadline(goal: Goal, now: Date): Date {
  if (goal.deadline) return new Date(goal.deadline);
  const q = endOfQuarter(goal.quarter, now.getFullYear());
  if (q && q.getTime() > now.getTime()) return q;
  // Fall back to end of the current year
  return new Date(now.getFullYear(), 11, 31, 23, 59, 59);
}

/**
 * Where a measurable goal *should* be by a given date to stay on pace for its
 * deadline — linear interpolation from start → deadline. Returns null unless the
 * goal has a numeric target and a deadline. Used for quarterly on-pace checkpoints.
 */
export function paceTargetByDate(goal: Goal, date: Date): number | null {
  if (typeof goal.target !== "number" || goal.target <= 0) return null;
  if (!goal.deadline) return null;
  const start = effectiveStart(goal).getTime();
  const end = new Date(goal.deadline).getTime();
  if (!isFinite(end)) return null;
  if (end <= start) return goal.target;
  const frac = Math.min(1, Math.max(0, (date.getTime() - start) / (end - start)));
  return Math.round(goal.target * frac);
}

/** Compute pace + projection. Only meaningful for measurable goals (target set). */
export function computeProjection(goal: Goal, now = new Date()): ProjectionResult {
  if (goal.done) {
    return {
      status: "complete",
      label: "Complete",
      tone: "text-gold",
      daysLate: null,
      requiredDailyRate: null,
      actualDailyRate: null,
      daysLeft: null,
      weeksLeft: null,
    };
  }
  if (typeof goal.target !== "number" || goal.target <= 0) {
    return {
      status: "no_data",
      label: "",
      tone: "text-muted-foreground",
      daysLate: null,
      requiredDailyRate: null,
      actualDailyRate: null,
      daysLeft: null,
      weeksLeft: null,
    };
  }

  const current = goal.current ?? 0;
  if (current >= goal.target) {
    return {
      status: "complete",
      label: "Target reached",
      tone: "text-gold",
      daysLate: null,
      requiredDailyRate: 0,
      actualDailyRate: null,
      daysLeft: null,
      weeksLeft: null,
    };
  }

  const start = effectiveStart(goal);
  const deadline = effectiveDeadline(goal, now);

  // Days elapsed in the goal's window (>= 0.5 day to avoid division blowups).
  const daysElapsed = Math.max(0.5, (now.getTime() - start.getTime()) / MS_PER_DAY);
  const daysTotal = Math.max(1, (deadline.getTime() - start.getTime()) / MS_PER_DAY);
  const daysLeft = Math.max(0, (deadline.getTime() - now.getTime()) / MS_PER_DAY);

  const needed = goal.target - current;
  const requiredDailyRate = daysLeft > 0 ? needed / daysLeft : Infinity;
  const actualDailyRate = current / daysElapsed;

  const projectedAtDeadline = current + actualDailyRate * daysLeft;
  const shortfall = goal.target - projectedAtDeadline;

  // How many days past deadline at current pace would we actually finish?
  const daysLate =
    actualDailyRate > 0 && shortfall > 0
      ? Math.ceil(shortfall / actualDailyRate)
      : 0;

  const ratio = requiredDailyRate > 0 ? actualDailyRate / requiredDailyRate : 1;
  const unit = goal.unit ? ` ${goal.unit}` : "";
  const daysLeftCeil = Math.max(0, Math.ceil(daysLeft));
  // How we phrase the time left when behind. We show days *remaining* to catch
  // up — an actionable, non-intimidating number — rather than `daysLate`, the
  // projected overshoot, which at a slow early pace balloons into thousands of
  // days and reads as broken (e.g. "2000 days off pace" with 120 days left).
  const timeLeftPhrase =
    daysLeftCeil <= 0
      ? "deadline's here"
      : `${daysLeftCeil} day${daysLeftCeil === 1 ? "" : "s"} left`;

  let status: ProjectionStatus;
  let label: string;
  let detail: string;
  let tone: string;

  if (ratio >= 1.1) {
    status = "ahead";
    label = "Ahead of pace";
    detail = `${(actualDailyRate / Math.max(1e-6, requiredDailyRate) * 100).toFixed(0)}% of required rate. You could ease off and still hit ${goal.target}${unit}.`;
    tone = "text-gold";
  } else if (ratio >= 0.9) {
    status = "on_pace";
    label = "On pace";
    detail = `Doing ${actualDailyRate.toFixed(2)}${unit}/day, need ${requiredDailyRate.toFixed(2)}${unit}/day. Keep it steady.`;
    tone = "text-teal";
  } else if (ratio >= 0.6) {
    status = "behind";
    label = `Behind — ${timeLeftPhrase} to catch up`;
    detail = `You need ${requiredDailyRate.toFixed(2)}${unit}/day to catch up; current pace is ${actualDailyRate.toFixed(2)}${unit}/day.`;
    tone = "text-orange-400";
  } else if (ratio > 0) {
    status = "behind_critical";
    label = `Well behind — ${timeLeftPhrase} to turn it around`;
    detail = `Needs ${requiredDailyRate.toFixed(2)}${unit}/day the rest of the way; current pace is ${actualDailyRate.toFixed(2)}${unit}/day. Adjusting the target or deadline is fair game.`;
    tone = "text-destructive";
  } else {
    status = "missing";
    label = "No progress yet";
    detail = `${needed}${unit} to go in ${daysLeftCeil} days. Log your first check-in to set the pace.`;
    tone = "text-destructive";
  }

  return {
    status,
    label,
    detail,
    tone,
    daysLate: daysLate || null,
    requiredDailyRate,
    actualDailyRate,
    daysLeft: Math.ceil(daysLeft),
    weeksLeft: Math.ceil(daysLeft / 7),
  };
}
