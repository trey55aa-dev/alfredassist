// A single active "challenge" — the 30-Day Hard routine and things like it.
// Alfred has no generic multi-challenge system; this is deliberately one
// small, editable record so the header never shows a permanently-wrong date.

import { useSyncExternalStore } from "react";
import { todayKey } from "./alfred";
import type { Habit, HabitLog } from "./habits";
import { isApplicableToDate, type RecurringTemplate } from "./recurring";

export interface ChallengeConfig {
  title: string;
  startDate: string; // YYYY-MM-DD, local
  totalDays: number;
  /** Optional 2026 goal this challenge tracks. When set, adherence is scoped
   *  to that goal's daily habits instead of the whole daily routine. */
  goalId?: string;
}

const KEY = "alfred.challenge";
export const CHALLENGE_CHANGED = "alfred.challenge:changed";

export const DEFAULT_CHALLENGE: ChallengeConfig = {
  title: "30-Day Hard",
  startDate: "2026-08-16",
  totalDays: 30,
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
  window.dispatchEvent(new Event(CHALLENGE_CHANGED));
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(CHALLENGE_CHANGED, cb);
  window.addEventListener("storage", cb);
  // Cloud sync adopting a value fires this key-specific event.
  window.addEventListener(`alfred.ls:${KEY}`, cb);
  return () => {
    window.removeEventListener(CHALLENGE_CHANGED, cb);
    window.removeEventListener("storage", cb);
    window.removeEventListener(`alfred.ls:${KEY}`, cb);
  };
}

/* useSyncExternalStore compares snapshots by reference, so getChallenge()'s
   fresh object every call would loop forever. Cache it against the raw
   string and only re-parse when that actually changes. */
let cachedRaw: string | null = null;
let cachedCfg: ChallengeConfig = DEFAULT_CHALLENGE;

function getChallengeSnapshot(): ChallengeConfig {
  const raw = typeof window === "undefined" ? null : localStorage.getItem(KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedCfg = getChallenge();
  }
  return cachedCfg;
}

/** Reactive challenge config — stays in sync across every component that
 *  reads it (edit it in one place, e.g. the Checklist's challenge badges
 *  update immediately) without a full page reload. */
export function useChallenge(): ChallengeConfig {
  return useSyncExternalStore(subscribe, getChallengeSnapshot, () => DEFAULT_CHALLENGE);
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
 * The daily habits this challenge tracks. With no goal linked, that's every
 * non-archived daily habit (the whole routine). Linked to a 2026 goal, it
 * narrows to just that goal's daily habits — the concrete, repeatable actions
 * that actually move it — so the challenge measures something specific
 * instead of "everything you do."
 */
export function challengeHabits(cfg: ChallengeConfig, habits: Habit[]): Habit[] {
  return habits.filter(
    (h) => !h.archived && h.cadence === "daily" && (!cfg.goalId || h.goalId === cfg.goalId),
  );
}

/**
 * "The routine" = every daily habit this challenge tracks (see
 * `challengeHabits`) plus, when no goal is linked, every enabled recurring
 * block on the days it's scheduled — the same set that already drives the
 * Dashboard's Daily Protocol ring. A goal-linked challenge sticks to that
 * goal's habits only, since a recurring calendar block isn't attributable to
 * any one goal. Walks from the challenge's start date through today (or the
 * challenge's last day, whichever is sooner), so a still-in-progress today
 * counts partially rather than waiting for midnight.
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

  const dailyHabits = challengeHabits(cfg, habits);
  const enabledTemplates = cfg.goalId ? [] : templates.filter((t) => t.enabled);

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

/* ---------- Per-day breakdown: which days actually slipped ---------- */

export type ChallengeDayStatus = "complete" | "partial" | "missed" | "today" | "future";

export interface ChallengeDay {
  /** YYYY-MM-DD, local. */
  date: string;
  /** 1-indexed day of the challenge. */
  dayNumber: number;
  /** Items the routine asked for that day. */
  applicable: number;
  /** Items actually ticked. */
  completed: number;
  status: ChallengeDayStatus;
}

/**
 * Every day of the challenge with what it asked for and what got done.
 *
 * Today is never "missed" — it's still in progress — and neither is yesterday
 * on the day after, per Alfred's grace-before-penalty rule: the caller decides
 * how to treat a partial day, but a day only reads as missed once it's fully
 * behind us.
 */
export function challengeDays(
  cfg: ChallengeConfig,
  habits: Habit[],
  habitLogs: HabitLog[],
  templates: RecurringTemplate[],
  completions: Record<string, true>,
  now = new Date(),
): ChallengeDay[] {
  const start = dateOnly(new Date(cfg.startDate + "T00:00:00"));
  const today = dateOnly(now);
  const todayStr = todayKey(today);

  const dailyHabits = challengeHabits(cfg, habits);
  const enabledTemplates = cfg.goalId ? [] : templates.filter((t) => t.enabled);

  const out: ChallengeDay[] = [];
  const cursor = new Date(start);

  for (let i = 0; i < cfg.totalDays; i++) {
    const dateStr = todayKey(cursor);
    let applicable = 0;
    let completed = 0;

    for (const h of dailyHabits) {
      applicable++;
      if (habitLogs.some((l) => l.habitId === h.id && l.date === dateStr)) completed++;
    }
    for (const t of enabledTemplates) {
      if (!isApplicableToDate(t, cursor)) continue;
      applicable++;
      if (completions[`${t.id}:${dateStr}`]) completed++;
    }

    let status: ChallengeDayStatus;
    if (dateStr > todayStr) status = "future";
    else if (dateStr === todayStr) status = "today";
    else if (applicable === 0 || completed >= applicable) status = "complete";
    else if (completed > 0) status = "partial";
    else status = "missed";

    out.push({ date: dateStr, dayNumber: i + 1, applicable, completed, status });
    cursor.setDate(cursor.getDate() + 1);
  }

  return out;
}

/** Days already behind us that weren't fully done — the ones worth reviewing. */
export function challengeSlippedDays(days: ChallengeDay[]): ChallengeDay[] {
  return days.filter((d) => d.status === "missed" || d.status === "partial");
}
