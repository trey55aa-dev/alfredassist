// Daily sub-goals: the small, repeatable thing a 2026 goal asks of you today.
//
// A goal like "Pay off the credit card" is a number you can't act on. What you
// can act on is "put $20 aside today", "don't spend on takeout today", or
// "write down what you spent". Those are daily targets — sub-goals that hang
// off a goal, show up in the daily protocol, and roll their answers back up.
//
// Three kinds, because they're answered differently:
//   amount — hit a number today ("save $20"). Logging it moves the goal.
//   avoid  — get through today without doing something ("no takeout"). Yes/no.
//   log    — record a number, no target ("how much did you spend?"). Tracking
//            only; it never moves the goal, because knowing isn't progress.

import { todayKey } from "./alfred";

export type DailyTargetKind = "amount" | "avoid" | "log";

export interface GoalDailyTarget {
  id: string;
  goalId: string;
  title: string;
  kind: DailyTargetKind;
  /** Target number for "amount". Ignored by "avoid" and "log". */
  amount?: number;
  /** Unit label — falls back to the parent goal's unit when unset. */
  unit?: string;
  createdAt: number;
  archived?: boolean;
}

/** One day's answer to one target. */
export interface DailyTargetEntry {
  /** "amount" and "log": the number recorded. */
  value?: number;
  /** "amount": hit the target. "avoid": got through the day clean. */
  done?: boolean;
}

export const GOAL_TARGETS_KEY = "alfred.goalTargets";
export const GOAL_TARGET_LOG_KEY = "alfred.goalTargetLog";
export const GOAL_TARGETS_CHANGED = "alfred.goalTargets:changed";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota */
  }
  window.dispatchEvent(new Event(GOAL_TARGETS_CHANGED));
}

/* ---------- targets ---------- */

export function loadTargets(): GoalDailyTarget[] {
  return read<GoalDailyTarget[]>(GOAL_TARGETS_KEY, []);
}

export function saveTargets(targets: GoalDailyTarget[]): void {
  write(GOAL_TARGETS_KEY, targets);
}

/** Live targets for one goal, oldest first. */
export function targetsForGoal(targets: GoalDailyTarget[], goalId: string): GoalDailyTarget[] {
  return targets.filter((t) => t.goalId === goalId && !t.archived);
}

export function addTarget(
  target: Omit<GoalDailyTarget, "id" | "createdAt">,
): GoalDailyTarget[] {
  const next = [
    ...loadTargets(),
    { ...target, id: crypto.randomUUID(), createdAt: Date.now() },
  ];
  saveTargets(next);
  return next;
}

export function removeTarget(id: string): GoalDailyTarget[] {
  const next = loadTargets().filter((t) => t.id !== id);
  saveTargets(next);
  // Drop that target's history too — an orphaned log is only dead weight.
  const log = loadTargetLog();
  let touched = false;
  for (const key of Object.keys(log)) {
    if (key.startsWith(`${id}|`)) {
      delete log[key];
      touched = true;
    }
  }
  if (touched) write(GOAL_TARGET_LOG_KEY, log);
  return next;
}

/* ---------- daily entries ---------- */

export type TargetLog = Record<string, DailyTargetEntry>;

export function entryKey(targetId: string, date: string): string {
  return `${targetId}|${date}`;
}

export function loadTargetLog(): TargetLog {
  return read<TargetLog>(GOAL_TARGET_LOG_KEY, {});
}

export function getEntry(
  log: TargetLog,
  targetId: string,
  date = todayKey(),
): DailyTargetEntry | undefined {
  return log[entryKey(targetId, date)];
}

/** Write (or clear) one day's answer. Passing null removes the entry. */
export function setEntry(
  targetId: string,
  entry: DailyTargetEntry | null,
  date = todayKey(),
): TargetLog {
  const log = loadTargetLog();
  const key = entryKey(targetId, date);
  if (entry === null) delete log[key];
  else log[key] = entry;
  write(GOAL_TARGET_LOG_KEY, log);
  return log;
}

/** Has this target been answered today? "log" counts once a number is in. */
export function isAnsweredToday(
  target: GoalDailyTarget,
  log: TargetLog,
  date = todayKey(),
): boolean {
  const e = getEntry(log, target.id, date);
  if (!e) return false;
  return target.kind === "log" ? e.value != null : !!e.done;
}

/**
 * How much logging this target should move its goal. Only "amount" moves a
 * goal — "avoid" has nothing to add, and "log" is an observation, not progress.
 */
export function goalDeltaFor(target: GoalDailyTarget, entry: DailyTargetEntry): number {
  if (target.kind !== "amount") return 0;
  return entry.value ?? target.amount ?? 0;
}

/** Consecutive days answered, ending today (or yesterday if today is untouched). */
export function targetStreak(
  target: GoalDailyTarget,
  log: TargetLog,
  today = new Date(),
): number {
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!isAnsweredToday(target, log, todayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  // 366 is a hard stop; a streak longer than a year still reads as "very long".
  for (let i = 0; i < 366; i++) {
    if (!isAnsweredToday(target, log, todayKey(cursor))) break;
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

/** Placeholder/label help so each kind explains itself in the UI. */
export const TARGET_KIND_LABEL: Record<DailyTargetKind, string> = {
  amount: "Hit an amount",
  avoid: "Avoid something",
  log: "Log a number",
};

export const TARGET_KIND_HINT: Record<DailyTargetKind, string> = {
  amount: "e.g. put $20 aside today — logging it moves the goal",
  avoid: "e.g. no takeout today — a yes/no you tick",
  log: "e.g. how much did you spend today? — tracked, doesn't move the goal",
};
