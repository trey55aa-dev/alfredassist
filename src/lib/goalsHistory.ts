// Daily progress history + projection for goals.
//
// A "check-in" stamps a YYYY-MM-DD key in goal.progressLog with the post-bump
// current value, and updates goal.lastCheckIn. The 14-day grid renders those
// keys back into a visible "days hit / days missed" strip on the goal card.
//
// Projection compares the rate you're *actually* making progress against the
// rate you'd *need* to hit the goal by its (real or quarter-inferred) deadline,
// and translates the gap into something direct: "Behind 4 days" / "On pace".

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
      const delta = Math.max(0, v - running);
      out.push({ date: key, logged: true, delta, value: v });
      running = v;
    } else {
      out.push({ date: key, logged: false, delta: 0, value: running });
    }
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
    label = `Behind — will miss by ${daysLate} day${daysLate === 1 ? "" : "s"}`;
    detail = `You need ${requiredDailyRate.toFixed(2)}${unit}/day to catch up; current pace is ${actualDailyRate.toFixed(2)}${unit}/day.`;
    tone = "text-orange-400";
  } else if (ratio > 0) {
    status = "behind_critical";
    label = `Falling apart — ${daysLate} days late at this rate`;
    detail = `Required ${requiredDailyRate.toFixed(2)}${unit}/day. Current ${actualDailyRate.toFixed(2)}${unit}/day. Cut the target or extend the deadline before this slips further.`;
    tone = "text-destructive";
  } else {
    status = "missing";
    label = "No progress yet";
    detail = `${needed}${unit} to go in ${Math.ceil(daysLeft)} days. Log your first check-in to set the pace.`;
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
  };
}
