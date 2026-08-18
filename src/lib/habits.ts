import { todayKey } from "./alfred";

export type Cadence = "daily" | "weekly" | "monthly" | "quarterly" | "annual";

export const CADENCES: Cadence[] = ["daily", "weekly", "monthly", "quarterly", "annual"];

export const CADENCE_LABEL: Record<Cadence, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

export const CADENCE_NOUN: Record<Cadence, string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  quarterly: "quarter",
  annual: "year",
};

export interface Habit {
  id: string;
  title: string;
  cadence: Cadence;
  goalId?: string;          // optional link to a 2026 goal
  goalIncrement?: number;   // amount to add to goal.current per tick (default 1)
  target?: number;          // optional target count per period (e.g. 3 / month)
  recoverySteps?: string[]; // user-defined "what to do to get back on track"
  createdAt: number;
  archived?: boolean;
}

/** A single tick of a habit on a specific date. */
export interface HabitLog {
  habitId: string;
  date: string; // YYYY-MM-DD
}

export const HABITS_KEY = "alfred.habits";
export const HABIT_LOGS_KEY = "alfred.habitLogs";

/* ---------- Completion times (device-local) ----------
   The cloud habit_logs table stores only (habit, date) — no time. To power
   "what hour you usually check in" stats we keep a separate local map of
   `${habitId}|${date}` -> ms-timestamp, recorded when a habit is ticked.
   This is intentionally device-local; it builds up from when you start ticking. */

export const HABIT_TIMES_KEY = "alfred.habitLogTimes";
/** Per-habit free-text comments — grounds Alfred's coaching. Device-local. */
export const HABIT_NOTES_KEY = "alfred.habitNotes";

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota */
  }
}

export function timeKey(habitId: string, date: string): string {
  return `${habitId}|${date}`;
}

export function loadHabitTimes(): Record<string, number> {
  return readJSON<Record<string, number>>(HABIT_TIMES_KEY, {});
}

export function recordHabitTime(habitId: string, date: string, ts = Date.now()): void {
  const all = loadHabitTimes();
  all[timeKey(habitId, date)] = ts;
  writeJSON(HABIT_TIMES_KEY, all);
}

export function removeHabitTime(habitId: string, date: string): void {
  const all = loadHabitTimes();
  delete all[timeKey(habitId, date)];
  writeJSON(HABIT_TIMES_KEY, all);
}

/** Drop every recorded time + note for a habit (called on delete). */
export function purgeHabitMeta(habitId: string): void {
  const times = loadHabitTimes();
  let changed = false;
  for (const k of Object.keys(times)) {
    if (k.startsWith(`${habitId}|`)) {
      delete times[k];
      changed = true;
    }
  }
  if (changed) writeJSON(HABIT_TIMES_KEY, times);

  const notes = loadHabitNotes();
  if (notes[habitId] !== undefined) {
    delete notes[habitId];
    writeJSON(HABIT_NOTES_KEY, notes);
  }
}

export function loadHabitNotes(): Record<string, string> {
  return readJSON<Record<string, string>>(HABIT_NOTES_KEY, {});
}

export function getHabitNote(habitId: string): string {
  return loadHabitNotes()[habitId] ?? "";
}

export function setHabitNote(habitId: string, text: string): void {
  const all = loadHabitNotes();
  const trimmed = text.trim();
  if (trimmed) all[habitId] = trimmed;
  else delete all[habitId];
  writeJSON(HABIT_NOTES_KEY, all);
}

/* ---------- Period keys ---------- */

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Returns ISO week number for a given date. */
function isoWeek(d: Date): { year: number; week: number } {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+tmp - +yearStart) / 86400000 + 1) / 7);
  return { year: tmp.getUTCFullYear(), week };
}

function quarterOf(d: Date): number {
  return Math.floor(d.getMonth() / 3) + 1;
}

/** A canonical key for the period containing `date` under a given cadence. */
export function periodKey(cadence: Cadence, date = new Date()): string {
  switch (cadence) {
    case "daily":
      return todayKey(date);
    case "weekly": {
      const { year, week } = isoWeek(date);
      return `${year}-W${pad(week)}`;
    }
    case "monthly":
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    case "quarterly":
      return `${date.getFullYear()}-Q${quarterOf(date)}`;
    case "annual":
      return `${date.getFullYear()}`;
  }
}

/** Length of one period in days (for missed-period math on daily/weekly). */
const PERIOD_DAYS: Record<Cadence, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 91,
  annual: 365,
};

/** Move date back by exactly one period. */
export function previousPeriodDate(cadence: Cadence, date: Date): Date {
  const d = new Date(date);
  switch (cadence) {
    case "daily":
      d.setDate(d.getDate() - 1);
      break;
    case "weekly":
      d.setDate(d.getDate() - 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() - 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() - 3);
      break;
    case "annual":
      d.setFullYear(d.getFullYear() - 1);
      break;
  }
  return d;
}

/* ---------- Streak math ---------- */

/** Build a Set of period-keys this habit was completed in. */
function completedPeriods(habit: Habit, logs: HabitLog[]): Set<string> {
  const set = new Set<string>();
  for (const l of logs) {
    if (l.habitId !== habit.id) continue;
    set.add(periodKey(habit.cadence, new Date(l.date + "T00:00:00")));
  }
  return set;
}

export function isCompleteForPeriod(
  habit: Habit,
  logs: HabitLog[],
  date = new Date()
): boolean {
  const key = periodKey(habit.cadence, date);
  return logs.some(
    (l) =>
      l.habitId === habit.id &&
      periodKey(habit.cadence, new Date(l.date + "T00:00:00")) === key
  );
}

/** Consecutive completed periods ending at the current period (or the previous one if current isn't done yet). */
export function currentStreakFor(habit: Habit, logs: HabitLog[], today = new Date()): number {
  const set = completedPeriods(habit, logs);
  let cursor = new Date(today);
  // anchor: include current period if done; otherwise start from previous
  if (!set.has(periodKey(habit.cadence, cursor))) {
    cursor = previousPeriodDate(habit.cadence, cursor);
  }
  let count = 0;
  while (set.has(periodKey(habit.cadence, cursor))) {
    count++;
    cursor = previousPeriodDate(habit.cadence, cursor);
  }
  return count;
}

export function longestStreakFor(habit: Habit, logs: HabitLog[]): number {
  const set = completedPeriods(habit, logs);
  if (set.size === 0) return 0;
  // sort dates of logs ascending; walk and check period continuity
  const dates = logs
    .filter((l) => l.habitId === habit.id)
    .map((l) => new Date(l.date + "T00:00:00"))
    .sort((a, b) => +a - +b);
  let best = 0;
  let run = 0;
  let prevKey: string | null = null;
  for (const d of dates) {
    const k = periodKey(habit.cadence, d);
    if (k === prevKey) continue; // same period, ignore dup
    if (prevKey) {
      const expected = periodKey(habit.cadence, previousPeriodDate(habit.cadence, d));
      if (expected === prevKey) {
        run++;
      } else {
        run = 1;
      }
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prevKey = k;
  }
  return best;
}

/** How many full periods have elapsed since this habit was last completed. 0 = current period done; 1 = missed last period; etc. */
export function periodsSinceLast(habit: Habit, logs: HabitLog[], today = new Date()): number {
  const set = completedPeriods(habit, logs);
  if (set.size === 0) return Infinity;
  let cursor = new Date(today);
  let i = 0;
  while (i < 366) {
    if (set.has(periodKey(habit.cadence, cursor))) return i;
    cursor = previousPeriodDate(habit.cadence, cursor);
    i++;
  }
  return Infinity;
}

/** Last 7 periods (oldest → newest) for the row visual. */
export function last7Periods(
  habit: Habit,
  logs: HabitLog[],
  today = new Date()
): { key: string; done: boolean; isCurrent: boolean }[] {
  const set = completedPeriods(habit, logs);
  const currentKey = periodKey(habit.cadence, today);
  const out: { key: string; done: boolean; isCurrent: boolean }[] = [];
  let cursor = new Date(today);
  for (let i = 0; i < 7; i++) {
    const k = periodKey(habit.cadence, cursor);
    out.unshift({ key: k, done: set.has(k), isCurrent: k === currentKey });
    cursor = previousPeriodDate(habit.cadence, cursor);
  }
  return out;
}

/* ---------- Recovery ---------- */

export interface Recovery {
  habit: Habit;
  missedPeriods: number;
  lastDoneKey: string | null;
  flavor: string;
  steps: string[];
}

const FLAVOR_BY_CADENCE: Record<Cadence, (title: string, missed: number) => string> = {
  daily: (t, m) =>
    m === 1
      ? `Sir, ${t.toLowerCase()} slipped yesterday. One small motion tonight restores the rhythm.`
      : `Sir, ${t.toLowerCase()} has been quiet for ${m} days. The campaign waits — but not forever.`,
  weekly: (t, m) =>
    `Sir, ${t.toLowerCase()} missed ${m === 1 ? "this past week" : `${m} weeks`}. A modest start re-opens the cadence.`,
  monthly: (t, m) =>
    `Sir, the month has turned without ${t.toLowerCase()}${m > 1 ? ` — ${m} months running` : ""}. Reclaim the chapter today.`,
  quarterly: (t, m) =>
    `Sir, ${t.toLowerCase()} has been off-roster ${m === 1 ? "this quarter" : `for ${m} quarters`}. Set the new tempo now.`,
  annual: (t) =>
    `Sir, ${t.toLowerCase()} hasn't been claimed this year. There is still ample runway to begin.`,
};

const DEFAULT_STEPS_BY_CADENCE: Record<Cadence, (title: string) => string[]> = {
  daily: (t) => [
    `Do the smallest possible version of "${t}" right now (2 minutes is enough).`,
    `Tick it off — the streak counter resets to 1, not zero.`,
    `Place tomorrow's attempt on the calendar before bed.`,
  ],
  weekly: (t) => [
    `Schedule one block this week for "${t}".`,
    `Lower the bar: half-effort still counts as a tick.`,
    `Tell one person — accountability multiplies follow-through.`,
  ],
  monthly: (t) => [
    `Pick a single deliverable for "${t}" this month and write it down.`,
    `Block 2 working sessions on the calendar before the week ends.`,
    `Review at month's end — adjust scope, never abandon.`,
  ],
  quarterly: (t) => [
    `Define one concrete milestone for "${t}" by the end of this quarter.`,
    `Break it into 3 monthly checkpoints.`,
    `Schedule a weekly 15-minute review.`,
  ],
  annual: (t) => [
    `Clarify what "done" looks like for "${t}" by year-end.`,
    `Assign it to a quarter on the 2026 plan.`,
    `Take the first action this week — momentum compounds.`,
  ],
};

export function buildRecovery(habit: Habit, logs: HabitLog[], today = new Date()): Recovery | null {
  // Grace before penalty: the current period is still open and is never a miss.
  // Anchor on the last fully-elapsed period (yesterday, for daily habits) instead.
  const anchor = previousPeriodDate(habit.cadence, today);
  const missed = periodsSinceLast(habit, logs, anchor);
  if (missed === 0) return null; // last fully-elapsed period was completed
  // For brand-new habits never done, treat as "1 missed period" so we coach onboarding
  const effectiveMissed = missed === Infinity ? 1 : missed;
  const lastKey =
    missed === Infinity
      ? null
      : (() => {
          const set = completedPeriods(habit, logs);
          let cursor = anchor;
          for (let i = 0; i < 366; i++) {
            const k = periodKey(habit.cadence, cursor);
            if (set.has(k)) return k;
            cursor = previousPeriodDate(habit.cadence, cursor);
          }
          return null;
        })();

  const steps =
    habit.recoverySteps && habit.recoverySteps.length > 0
      ? habit.recoverySteps
      : DEFAULT_STEPS_BY_CADENCE[habit.cadence](habit.title);

  return {
    habit,
    missedPeriods: effectiveMissed,
    lastDoneKey: lastKey,
    flavor: FLAVOR_BY_CADENCE[habit.cadence](habit.title, effectiveMissed),
    steps,
  };
}

/** All non-archived habits whose last fully-elapsed period is incomplete, sorted by severity. */
export function habitsAtRisk(habits: Habit[], logs: HabitLog[], today = new Date()): Recovery[] {
  return habits
    .filter((h) => !h.archived)
    .map((h) => buildRecovery(h, logs, today))
    .filter((r): r is Recovery => r !== null)
    .sort((a, b) => b.missedPeriods - a.missedPeriods);
}

/* ---------- Mutations ---------- */

/** Toggle a habit for the current period — adds or removes today's log. */
export function toggleHabitForToday(
  habit: Habit,
  logs: HabitLog[],
  today = new Date()
): { logs: HabitLog[]; nowComplete: boolean } {
  const isDone = isCompleteForPeriod(habit, logs, today);
  const key = periodKey(habit.cadence, today);
  if (isDone) {
    // remove every log of this habit that falls in current period
    const next = logs.filter(
      (l) =>
        !(
          l.habitId === habit.id &&
          periodKey(habit.cadence, new Date(l.date + "T00:00:00")) === key
        )
    );
    return { logs: next, nowComplete: false };
  }
  return {
    logs: [...logs, { habitId: habit.id, date: todayKey(today) }],
    nowComplete: true,
  };
}

/* ---------- Seeds ---------- */

export const SEED_HABITS: Habit[] = [
  // Daily — mirrors the existing protocol
  { id: "h-d1", title: "Morning hydration & stretch", cadence: "daily", createdAt: 0 },
  { id: "h-d2", title: "Review top 3 priorities", cadence: "daily", createdAt: 0 },
  { id: "h-d3", title: "Deep work block — 90 min", cadence: "daily", createdAt: 0 },
  { id: "h-d4", title: "Train body (mobility / lift / run)", cadence: "daily", createdAt: 0, goalId: "g3" },
  { id: "h-d5", title: "Read or skill study — 30 min", cadence: "daily", createdAt: 0 },
  { id: "h-d6", title: "Inbox to zero", cadence: "daily", createdAt: 0 },
  { id: "h-d7", title: "Evening shutdown ritual", cadence: "daily", createdAt: 0 },

  // Weekly — the previous "weekly anchors"
  { id: "h-w1", title: "Weekly review — wins & losses", cadence: "weekly", createdAt: 0 },
  { id: "h-w2", title: "Plan next week's priorities", cadence: "weekly", createdAt: 0 },
  { id: "h-w3", title: "Long training session", cadence: "weekly", createdAt: 0 },
  { id: "h-w4", title: "Meal prep & groceries", cadence: "weekly", createdAt: 0 },
  { id: "h-w5", title: "Connect with one person", cadence: "weekly", createdAt: 0 },
  { id: "h-w6", title: "Financial check-in", cadence: "weekly", createdAt: 0 },

  // Monthly seeds tied to goals
  { id: "h-m1", title: "Finish a book", cadence: "monthly", createdAt: 0, goalId: "g14", goalIncrement: 1 },
  { id: "h-m2", title: "Master a new recipe", cadence: "monthly", createdAt: 0, goalId: "g19", goalIncrement: 1 },

  // Quarterly seed
  { id: "h-q1", title: "Quarterly campaign review", cadence: "quarterly", createdAt: 0 },
];
