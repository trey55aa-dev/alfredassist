// Per-event timer/stopwatch with cross-page persistence.
// Only ONE timer can be active at a time — starting a new one stops the prior.

import type { AgendaEvent } from "./agenda";

export type TimerMode = "stopwatch" | "countdown";

export interface ActiveTimer {
  eventId: string;
  eventTitle: string;
  /** "stopwatch" counts up; "countdown" counts down toward `targetSeconds`. */
  mode: TimerMode;
  /** Target seconds for countdown. Ignored for stopwatch. */
  targetSeconds: number;
  /** Epoch ms the current run segment started. null if paused. */
  runningSince: number | null;
  /** Seconds accumulated from previous run segments (sum across pauses). */
  accumulatedSeconds: number;
  /** Epoch ms the timer was first started — for analytics. */
  startedAt: number;
}

export interface TimerHistoryEntry {
  eventId: string;
  eventTitle: string;
  mode: TimerMode;
  totalSeconds: number;
  startedAt: number;
  endedAt: number;
}

const ACTIVE_KEY = "alfred.timer.active";
const HISTORY_KEY = "alfred.timer.history";
export const TIMER_CHANGED = "alfred.timer:changed";

function notify() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TIMER_CHANGED));
  }
}

export function getActiveTimer(): ActiveTimer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveTimer;
  } catch {
    return null;
  }
}

function setActiveTimer(t: ActiveTimer | null) {
  if (typeof window === "undefined") return;
  if (t) localStorage.setItem(ACTIVE_KEY, JSON.stringify(t));
  else localStorage.removeItem(ACTIVE_KEY);
  notify();
}

/** Total elapsed seconds for a timer right now. */
export function elapsedSeconds(t: ActiveTimer, now = Date.now()): number {
  const live = t.runningSince ? Math.max(0, (now - t.runningSince) / 1000) : 0;
  return Math.floor(t.accumulatedSeconds + live);
}

/** For countdown: seconds remaining. May be 0 or negative if overrun. */
export function remainingSeconds(t: ActiveTimer, now = Date.now()): number {
  if (t.mode !== "countdown") return 0;
  return t.targetSeconds - elapsedSeconds(t, now);
}

export interface StartArgs {
  event: Pick<AgendaEvent, "id" | "title" | "estimatedMinutes" | "start" | "end">;
  mode: TimerMode;
  /** Override estimate — falls back to event.estimatedMinutes, else scheduled duration. */
  targetMinutes?: number;
}

export function startTimer(args: StartArgs): ActiveTimer {
  const existing = getActiveTimer();
  if (existing) {
    // Stop it first and record history.
    stopTimer({ saveHistory: true });
  }
  const targetMinutes =
    args.targetMinutes ??
    args.event.estimatedMinutes ??
    Math.max(
      5,
      Math.round(
        (new Date(args.event.end).getTime() -
          new Date(args.event.start).getTime()) /
          60_000,
      ),
    );
  const now = Date.now();
  const t: ActiveTimer = {
    eventId: args.event.id,
    eventTitle: args.event.title,
    mode: args.mode,
    targetSeconds: Math.max(60, targetMinutes * 60),
    runningSince: now,
    accumulatedSeconds: 0,
    startedAt: now,
  };
  setActiveTimer(t);
  return t;
}

export function pauseTimer(): ActiveTimer | null {
  const t = getActiveTimer();
  if (!t || !t.runningSince) return t;
  const now = Date.now();
  const next: ActiveTimer = {
    ...t,
    accumulatedSeconds: elapsedSeconds(t, now),
    runningSince: null,
  };
  setActiveTimer(next);
  return next;
}

export function resumeTimer(): ActiveTimer | null {
  const t = getActiveTimer();
  if (!t || t.runningSince) return t;
  const next: ActiveTimer = { ...t, runningSince: Date.now() };
  setActiveTimer(next);
  return next;
}

export interface StopResult {
  recorded: TimerHistoryEntry | null;
  totalSeconds: number;
}

export function stopTimer(opts: { saveHistory?: boolean } = {}): StopResult {
  const t = getActiveTimer();
  if (!t) return { recorded: null, totalSeconds: 0 };
  const now = Date.now();
  const total = elapsedSeconds(t, now);
  let recorded: TimerHistoryEntry | null = null;
  if (opts.saveHistory && total >= 30) {
    recorded = {
      eventId: t.eventId,
      eventTitle: t.eventTitle,
      mode: t.mode,
      totalSeconds: total,
      startedAt: t.startedAt,
      endedAt: now,
    };
    appendHistory(recorded);
  }
  setActiveTimer(null);
  return { recorded, totalSeconds: total };
}

function loadHistory(): TimerHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TimerHistoryEntry[];
  } catch {
    return [];
  }
}

function appendHistory(entry: TimerHistoryEntry) {
  const list = loadHistory();
  list.push(entry);
  // Cap at last 500 entries
  const capped = list.slice(-500);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(capped));
}

/** Returns avg minutes spent on prior timer sessions for this event id. */
export function averageActualForEvent(eventId: string): {
  avgMinutes: number;
  sessions: number;
} | null {
  const list = loadHistory().filter((h) => h.eventId === eventId);
  if (list.length === 0) return null;
  const totalSec = list.reduce((acc, h) => acc + h.totalSeconds, 0);
  return {
    avgMinutes: totalSec / list.length / 60,
    sessions: list.length,
  };
}

/** Format seconds as MM:SS or HH:MM:SS. */
export function formatTimerDisplay(seconds: number): string {
  const abs = Math.abs(seconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = Math.floor(abs % 60);
  const sign = seconds < 0 ? "-" : "";
  if (h > 0) {
    return `${sign}${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${sign}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
