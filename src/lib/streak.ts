import { todayKey } from "./alfred";

export interface StreakState {
  /** Map of YYYY-MM-DD → true for days the daily checklist hit 100% */
  completedDays: Record<string, true>;
  /** Last date we recorded — for write-only-on-change semantics */
  lastRecorded?: string;
  lastWasComplete?: boolean;
}

export const STREAK_KEY = "alfred.streak";

export const emptyStreak: StreakState = { completedDays: {} };

function dayBefore(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}

/** Current consecutive-day streak ending today (or yesterday if today not yet complete). */
export function currentStreak(state: StreakState, today = todayKey()): number {
  const days = state.completedDays;
  // Anchor: today if completed, otherwise yesterday (so streak persists until you miss a full day)
  let cursor = days[today] ? today : dayBefore(today);
  let count = 0;
  while (days[cursor]) {
    count++;
    cursor = dayBefore(cursor);
  }
  return count;
}

/** Longest streak ever recorded. */
export function longestStreak(state: StreakState): number {
  const sorted = Object.keys(state.completedDays).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    if (prev && dayBefore(d) === prev) {
      run++;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prev = d;
  }
  return best;
}

/** Returns last 7 day-completion booleans, oldest → newest. */
export function last7Days(state: StreakState, today = todayKey()): { date: string; done: boolean }[] {
  const out: { date: string; done: boolean }[] = [];
  let cursor = today;
  for (let i = 0; i < 7; i++) {
    out.unshift({ date: cursor, done: !!state.completedDays[cursor] });
    cursor = dayBefore(cursor);
  }
  return out;
}

/**
 * Reconcile the streak state with whether today's checklist is currently 100%.
 * Marks today as complete when it is, removes today's mark if user un-checks back below 100%.
 * Returns the next state (caller decides whether it changed).
 */
export function reconcileToday(
  state: StreakState,
  isCompleteToday: boolean,
  today = todayKey()
): StreakState {
  const had = !!state.completedDays[today];
  if (isCompleteToday === had && state.lastRecorded === today) return state;

  const completedDays = { ...state.completedDays };
  if (isCompleteToday) {
    completedDays[today] = true;
  } else {
    delete completedDays[today];
  }
  return {
    completedDays,
    lastRecorded: today,
    lastWasComplete: isCompleteToday,
  };
}
