// A single active "challenge" — the 35-Day Reset and things like it. Alfred
// has no generic multi-challenge system; this is deliberately one small,
// editable record so the header never shows a permanently-wrong date.

import { todayKey } from "./alfred";
import type { Habit, HabitLog } from "./habits";
import { isApplicableToDate, type RecurringTemplate } from "./recurring";

export interface ChallengeConfig {
  title: string;
  startDate: string; // YYYY-MM-DD, local
  totalDays: number;
}

const KEY = "alfred.challenge";

export const DEFAULT_CHALLENGE: ChallengeConfig = {
  title: "35-Day Reset",
  startDate: "2026-08-08",
  totalDays: 35,
};

export function getChallenge(): ChallengeConfig {
  if (typeof window === "undefined") return DEFAULT_CHALLENGE;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_CHALLENGE;
    const parsed = JSON.parse(raw) as Partial<ChallengeConfig>;
    if (!parsed.title || !parsed.startDate || !parsed.totalDays) return DEFAULT_CHALLENGE;
    return parsed as ChallengeConfig;
  } catch {
    return DEFAULT_CHALLENGE;
  }
}

export function setChallenge(cfg: ChallengeConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg));
  } catch {
    /* quota */
  }
}

export type ChallengeState = "upcoming" | "active" | "complete";

export interface ChallengeStatus {
  state: ChallengeState;
  /** 1-indexed. Clamped to [1, totalDays] even in "complete" state. */
  dayNumber: number;
  totalDays: number;
  daysUntilStart: number;
  /** Fraction of the challenge elapsed, clamped to [0, 1] — for a progress bar. */
  pctElapsed: number;
}

function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function challengeStatus(cfg: ChallengeConfig, now = new Date()): ChallengeStatus {
  const start = dateOnly(new Date(cfg.startDate + "T00:00:00"));
  const today = dateOnly(now);
  const elapsedDays = Math.round((today.getTime() - start.getTime()) / 86_400_000);

  if (elapsedDays < 0) {
    return {
      state: "upcoming",
      dayNumber: 1,
      totalDays: cfg.totalDays,
      daysUntilStart: -elapsedDays,
      pctElapsed: 0,
    };
  }
  if (elapsedDays >= cfg.totalDays) {
    return {
      state: "complete",
      dayNumber: cfg.totalDays,
      totalDays: cfg.totalDays,
      daysUntilStart: 0,
      pctElapsed: 1,
    };
  }
  return {
    state: "active",
    dayNumber: elapsedDays + 1,
    totalDays: cfg.totalDays,
    daysUntilStart: 0,
    pctElapsed: (elapsedDays + 1) / cfg.totalDays,
  };
}

/* ---------- Adherence: did the routine actually happen? ---------- */

export interface AdherenceResult {
  /** Completed items / applicable items across every elapsed day. 0 if no days have elapsed yet. */
  pct: number;
  completed: number;
  applicable: number;
}

/**
 * "The routine" = every non-archived daily habit (always applicable) plus
 * every enabled recurring block on the days it's scheduled — the same set
 * that already drives the Dashboard's Daily Protocol ring. Walks from the
 * challenge's start date through today (or the challenge's last day,
 * whichever is sooner), so a still-in-progress today counts partially
 * rather than waiting for midnight.
 */
export function computeAdherence(
  cfg: ChallengeConfig,
  habits: Habit[],
  habitLogs: HabitLog[],
  templates: RecurringTemplate[],
  completions: Record<string, true>,
  now = new Date(),
): AdherenceResult {
  const start = dateOnly(new Date(cfg.startDate + "T00:00:00"));
  const today = dateOnly(now);
  if (today < start) return { pct: 0, completed: 0, applicable: 0 };

  const lastPossible = new Date(start);
  lastPossible.setDate(lastPossible.getDate() + cfg.totalDays - 1);
  const end = today < lastPossible ? today : lastPossible;

  const dailyHabits = habits.filter((h) => !h.archived && h.cadence === "daily");
  const enabledTemplates = templates.filter((t) => t.enabled);

  let completed = 0;
  let applicable = 0;

  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const dateStr = todayKey(cursor);

    for (const h of dailyHabits) {
      applicable++;
      if (habitLogs.some((l) => l.habitId === h.id && l.date === dateStr)) completed++;
    }

    for (const t of enabledTemplates) {
      if (!isApplicableToDate(t, cursor)) continue;
      applicable++;
      if (completions[`${t.id}:${dateStr}`]) completed++;
    }
  }

  return { completed, applicable, pct: applicable > 0 ? completed / applicable : 0 };
}
