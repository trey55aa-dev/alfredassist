// Streaks-style analytics for a single habit, computed from logs (+ local
// completion times). Daily-centric; non-daily cadences degrade gracefully.

import {
  type Habit,
  type HabitLog,
  currentStreakFor,
  longestStreakFor,
} from "./habits";
import { todayKey } from "./alfred";

/* ---------- date helpers ---------- */

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function parseYmd(s: string): Date {
  return new Date(s + "T00:00:00");
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Set of YYYY-MM-DD strings this habit was logged on. */
export function completedDates(habit: Habit, logs: HabitLog[]): Set<string> {
  const set = new Set<string>();
  for (const l of logs) if (l.habitId === habit.id) set.add(l.date);
  return set;
}

/** Effective tracking start: createdAt, else earliest log, else today. */
export function habitStart(habit: Habit, logs: HabitLog[]): Date {
  if (habit.createdAt && habit.createdAt > 0) return startOfDay(new Date(habit.createdAt));
  const mine = logs.filter((l) => l.habitId === habit.id).map((l) => l.date).sort();
  if (mine.length > 0) return parseYmd(mine[0]);
  return startOfDay(new Date());
}

/* ---------- month calendar ---------- */

export type DayState = "done" | "missed" | "today" | "future" | "pre" | "pending" | "none";

export interface DayCell {
  date: Date;
  ymd: string;
  inMonth: boolean;
  state: DayState;
  /** completion hour (0–23) if a timestamp was recorded that day */
  hour: number | null;
}

/** 6-week (42-cell) Sunday-first grid for the given month. */
export function monthCells(
  habit: Habit,
  logs: HabitLog[],
  times: Record<string, number>,
  year: number,
  month: number,
  today = new Date(),
): DayCell[] {
  const set = completedDates(habit, logs);
  const start = habitStart(habit, logs);
  const startYmd = ymd(start);
  const todayY = todayKey(today);
  // Yesterday gets a one-day grace: still uncounted, but not yet a "miss" — you
  // may just have forgotten to tick it. It firms up to "missed" the day after.
  const yesterdayY = ymd(addDays(startOfDay(today), -1));
  const daily = habit.cadence === "daily";

  const first = new Date(year, month, 1);
  const gridStart = addDays(first, -first.getDay()); // back up to Sunday

  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = addDays(gridStart, i);
    const key = ymd(date);
    const inMonth = date.getMonth() === month;
    const done = set.has(key);
    const ts = times[`${habit.id}|${key}`];

    let state: DayState;
    if (done) state = "done";
    else if (key > todayY) state = "future";
    else if (key === todayY) state = "today";
    else if (daily && key >= startYmd) state = key >= yesterdayY ? "pending" : "missed";
    else state = "none"; // non-daily empty day, or before tracking began

    cells.push({ date, ymd: key, inMonth, state, hour: ts != null ? new Date(ts).getHours() : null });
  }
  return cells;
}

/* ---------- aggregate stats ---------- */

export interface HabitStats {
  cadence: Habit["cadence"];
  current: number;
  longest: number;
  last7Done: number;
  last30Done: number;
  last7Pct: number;
  last30Pct: number;
  /** completion % since tracking began this year */
  yearPct: number;
  yearDone: number;
  yearElapsed: number;
  totalCompleted: number;
  totalMisses: number;
  /** misses bucketed by weekday, 0 = Sunday */
  missesByWeekday: number[];
  /** worst weekday by misses, or null */
  worstWeekday: number | null;
  /** completion-hour histogram (24) from recorded times */
  hourHist: number[];
  peakHour: number | null;
  timedCount: number;
}

const MAX_DAYS = 366 * 6; // safety cap on iteration

export function computeHabitStats(
  habit: Habit,
  logs: HabitLog[],
  times: Record<string, number>,
  today = new Date(),
): HabitStats {
  const set = completedDates(habit, logs);
  const daily = habit.cadence === "daily";
  const todayMid = startOfDay(today);
  const todayY = todayKey(today);

  // ── streaks (cadence-aware, reuse existing math) ──
  const current = currentStreakFor(habit, logs, today);
  const longest = Math.max(longestStreakFor(habit, logs), current);

  // ── rolling windows (by calendar day) ──
  const countLastDays = (n: number) => {
    let c = 0;
    for (let i = 0; i < n; i++) if (set.has(ymd(addDays(todayMid, -i)))) c++;
    return c;
  };
  const last7Done = countLastDays(7);
  const last30Done = countLastDays(30);

  // ── this-year completion + total misses + weekday misses (daily only) ──
  const start = habitStart(habit, logs);
  const jan1 = new Date(today.getFullYear(), 0, 1);
  const yearStart = start > jan1 ? start : jan1;

  let yearDone = 0;
  let yearElapsed = 0;
  let totalMisses = 0;
  const missesByWeekday = [0, 0, 0, 0, 0, 0, 0];

  if (daily) {
    // year window: yearStart .. today inclusive
    for (let d = new Date(yearStart), i = 0; d <= todayMid && i < MAX_DAYS; d = addDays(d, 1), i++) {
      yearElapsed++;
      if (set.has(ymd(d))) yearDone++;
    }
    // total misses: start .. two days ago. Today is still pending and yesterday
    // sits in its one-day grace window, so neither counts as a miss yet.
    const graceCutoff = addDays(todayMid, -2);
    for (let d = new Date(start), i = 0; d <= graceCutoff && i < MAX_DAYS; d = addDays(d, 1), i++) {
      if (!set.has(ymd(d))) {
        totalMisses++;
        missesByWeekday[d.getDay()]++;
      }
    }
  }

  const totalCompleted = [...set].filter((k) => k <= todayY).length;
  const yearPct = yearElapsed > 0 ? Math.round((yearDone / yearElapsed) * 100) : 0;

  let worstWeekday: number | null = null;
  if (daily && totalMisses > 0) {
    let max = -1;
    missesByWeekday.forEach((m, i) => {
      if (m > max) { max = m; worstWeekday = i; }
    });
  }

  // ── completion-hour histogram ──
  const hourHist = new Array(24).fill(0);
  let timedCount = 0;
  for (const k of Object.keys(times)) {
    if (!k.startsWith(`${habit.id}|`)) continue;
    const date = k.slice(habit.id.length + 1);
    if (!set.has(date)) continue; // only count hours for days that are actually completed
    const h = new Date(times[k]).getHours();
    hourHist[h]++;
    timedCount++;
  }
  let peakHour: number | null = null;
  if (timedCount > 0) {
    let max = -1;
    hourHist.forEach((c, h) => { if (c > max) { max = c; peakHour = h; } });
  }

  return {
    cadence: habit.cadence,
    current,
    longest,
    last7Done,
    last30Done,
    last7Pct: Math.round((last7Done / 7) * 100),
    last30Pct: Math.round((last30Done / 30) * 100),
    yearPct,
    yearDone,
    yearElapsed,
    totalCompleted,
    totalMisses,
    missesByWeekday,
    worstWeekday,
    hourHist,
    peakHour,
    timedCount,
  };
}

/* ---------- 365-day heatmap ---------- */

export interface HeatCell {
  date: Date;
  ymd: string;
  done: boolean;
  /** false for days before the habit existed — rendered as empty space, not "not done" */
  inRange: boolean;
}

export interface YearHeatmap {
  /** Sunday-first columns, oldest to newest, each with 7 day-cells. */
  weeks: HeatCell[][];
  /** Count of completions within the trailing `days` window (like the Streaks app's yearly tally). */
  totalDone: number;
  rangeStart: string;
  rangeEnd: string;
}

/** Trailing N-day (default 365) activity grid — how many times a habit was done, laid out like a
 *  GitHub/Streaks-style heatmap. Weeks are Sunday-aligned so the grid renders as clean columns. */
export function yearHeatmap(
  habit: Habit,
  logs: HabitLog[],
  today = new Date(),
  days = 365,
): YearHeatmap {
  const set = completedDates(habit, logs);
  const todayMid = startOfDay(today);
  const start = habitStart(habit, logs);
  const rangeStart = addDays(todayMid, -(days - 1));
  const alignedStart = addDays(rangeStart, -rangeStart.getDay());

  const cells: HeatCell[] = [];
  let totalDone = 0;
  for (let d = new Date(alignedStart); d <= todayMid; d = addDays(d, 1)) {
    const key = ymd(d);
    const done = set.has(key);
    const inRange = d >= start;
    if (done && d >= rangeStart) totalDone++;
    cells.push({ date: new Date(d), ymd: key, done, inRange });
  }

  const weeks: HeatCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return { weeks, totalDone, rangeStart: ymd(rangeStart), rangeEnd: ymd(todayMid) };
}

/* ---------- formatting helpers ---------- */

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_FULL = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];

export function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}
