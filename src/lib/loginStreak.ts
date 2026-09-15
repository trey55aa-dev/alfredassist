// Login streak — consecutive days the user has opened Alfred.
//
// Stored as a plain array of day keys rather than a running counter, for two
// reasons: the cloud sync layer union-merges arrays (so a day opened on the
// phone and a day opened on the laptop both survive, where a counter would
// clobber), and the streak stays derivable — no stored number can drift out of
// step with the days behind it.

import { useSyncExternalStore } from "react";
import { todayKey } from "./alfred";

const KEY = "alfred.loginStreak";
export const LOGIN_STREAK_CHANGED = "alfred.loginStreak:changed";

export interface LoginStreakStats {
  /** Consecutive days ending today. 0 only before the first ever open. */
  current: number;
  /** Longest run ever recorded. */
  best: number;
}

export function getLoginDays(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((d): d is string => typeof d === "string");
  } catch {
    return [];
  }
}

/**
 * Note today as a day the user showed up. Idempotent — called on every app
 * open, but only the first one each day changes anything.
 */
export function recordLogin(now = new Date()): void {
  if (typeof window === "undefined") return;
  const today = todayKey(now);
  const days = getLoginDays();
  if (days.includes(today)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify([...days, today].sort()));
  } catch {
    /* quota */
  }
  window.dispatchEvent(new Event(LOGIN_STREAK_CHANGED));
}

function shiftDay(key: string, delta: number): string {
  const d = new Date(key + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return todayKey(d);
}

/**
 * Current run counts back from today. Yesterday still counts as the anchor if
 * today hasn't been recorded yet — grace before penalty: a streak isn't broken
 * until a whole day has actually been missed.
 */
export function loginStreakFrom(days: string[], now = new Date()): LoginStreakStats {
  const set = new Set(days);
  if (set.size === 0) return { current: 0, best: 0 };

  const today = todayKey(now);
  let cursor = set.has(today) ? today : shiftDay(today, -1);
  let current = 0;
  while (set.has(cursor)) {
    current++;
    cursor = shiftDay(cursor, -1);
  }

  let best = 0;
  let run = 0;
  const sorted = [...set].sort();
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && sorted[i] === shiftDay(sorted[i - 1], 1) ? run + 1 : 1;
    if (run > best) best = run;
  }

  return { current, best };
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(LOGIN_STREAK_CHANGED, cb);
  window.addEventListener("storage", cb);
  // Cloud sync adopting a value fires this key-specific event.
  window.addEventListener(`alfred.ls:${KEY}`, cb);
  return () => {
    window.removeEventListener(LOGIN_STREAK_CHANGED, cb);
    window.removeEventListener("storage", cb);
    window.removeEventListener(`alfred.ls:${KEY}`, cb);
  };
}

/* useSyncExternalStore compares snapshots by reference, so a fresh object each
   call would loop forever. Cache against the raw string, as useChallenge does. */
const EMPTY: LoginStreakStats = { current: 0, best: 0 };
let cachedRaw: string | null = null;
let cachedStats: LoginStreakStats = EMPTY;

function getSnapshot(): LoginStreakStats {
  const raw = typeof window === "undefined" ? null : localStorage.getItem(KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedStats = loginStreakFrom(getLoginDays());
  }
  return cachedStats;
}

/** Reactive login streak — updates the moment today's open is recorded. */
export function useLoginStreak(): LoginStreakStats {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}
