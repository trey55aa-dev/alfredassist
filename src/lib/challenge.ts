// A single active "challenge" — the 30-Day Hard routine and things like it.
// Alfred has no generic multi-challenge system; this is deliberately one
// small, editable record so the header never shows a permanently-wrong date.

import { useSyncExternalStore } from "react";
import { todayKey } from "./alfred";
import { completedPeriods, periodKey, type Habit, type HabitLog } from "./habits";
import { isApplicableToDate, type RecurringTemplate } from "./recurring";

/** Color themes for the challenge banner. Keyed so only the id is persisted;
 *  the gradients live here so a saved challenge can never drift out of style. */
export type ChallengeColor = "ember" | "ocean" | "violet" | "forest" | "rose" | "slate";

export interface ChallengeTheme {
  label: string;
  /** Card border color. */
  border: string;
  /** Main background gradient. */
  background: string;
  /** Corner glow overlay. */
  glow: string;
  /** Progress-bar gradient. */
  bar: string;
  /** Solid preview fill for the picker swatch. */
  swatch: string;
}

export const CHALLENGE_THEMES: Record<ChallengeColor, ChallengeTheme> = {
  ember: {
    label: "Ember",
    border: "hsl(15 70% 45% / 0.35)",
    background: "linear-gradient(135deg, hsl(355 65% 22%) 0%, hsl(15 75% 28%) 45%, hsl(35 85% 32%) 100%)",
    glow: "radial-gradient(circle at 85% -10%, hsl(35 90% 55% / 0.5), transparent 60%)",
    bar: "linear-gradient(90deg, hsl(35 90% 55%), hsl(15 85% 55%))",
    swatch: "linear-gradient(135deg, hsl(15 75% 45%), hsl(35 85% 50%))",
  },
  ocean: {
    label: "Ocean",
    border: "hsl(205 70% 45% / 0.35)",
    background: "linear-gradient(135deg, hsl(220 60% 20%) 0%, hsl(200 70% 26%) 45%, hsl(185 70% 30%) 100%)",
    glow: "radial-gradient(circle at 85% -10%, hsl(190 90% 55% / 0.5), transparent 60%)",
    bar: "linear-gradient(90deg, hsl(190 85% 55%), hsl(210 85% 55%))",
    swatch: "linear-gradient(135deg, hsl(210 75% 45%), hsl(185 80% 45%))",
  },
  violet: {
    label: "Violet",
    border: "hsl(270 60% 55% / 0.35)",
    background: "linear-gradient(135deg, hsl(265 55% 22%) 0%, hsl(280 55% 28%) 45%, hsl(310 55% 32%) 100%)",
    glow: "radial-gradient(circle at 85% -10%, hsl(290 90% 65% / 0.5), transparent 60%)",
    bar: "linear-gradient(90deg, hsl(290 80% 62%), hsl(255 80% 62%))",
    swatch: "linear-gradient(135deg, hsl(270 70% 52%), hsl(305 65% 52%))",
  },
  forest: {
    label: "Forest",
    border: "hsl(150 55% 40% / 0.35)",
    background: "linear-gradient(135deg, hsl(160 50% 16%) 0%, hsl(150 55% 22%) 45%, hsl(95 50% 28%) 100%)",
    glow: "radial-gradient(circle at 85% -10%, hsl(120 80% 55% / 0.45), transparent 60%)",
    bar: "linear-gradient(90deg, hsl(120 70% 50%), hsl(160 70% 45%))",
    swatch: "linear-gradient(135deg, hsl(150 65% 38%), hsl(110 55% 42%))",
  },
  rose: {
    label: "Rose",
    border: "hsl(340 65% 50% / 0.35)",
    background: "linear-gradient(135deg, hsl(335 55% 22%) 0%, hsl(345 60% 30%) 45%, hsl(15 65% 34%) 100%)",
    glow: "radial-gradient(circle at 85% -10%, hsl(350 90% 65% / 0.5), transparent 60%)",
    bar: "linear-gradient(90deg, hsl(350 85% 62%), hsl(320 80% 60%))",
    swatch: "linear-gradient(135deg, hsl(340 70% 52%), hsl(10 70% 52%))",
  },
  slate: {
    label: "Slate",
    border: "hsl(215 20% 55% / 0.35)",
    background: "linear-gradient(135deg, hsl(220 18% 18%) 0%, hsl(215 16% 26%) 45%, hsl(210 14% 34%) 100%)",
    glow: "radial-gradient(circle at 85% -10%, hsl(210 30% 70% / 0.4), transparent 60%)",
    bar: "linear-gradient(90deg, hsl(210 25% 65%), hsl(220 20% 50%))",
    swatch: "linear-gradient(135deg, hsl(215 18% 45%), hsl(210 16% 55%))",
  },
};

export const CHALLENGE_COLORS = Object.keys(CHALLENGE_THEMES) as ChallengeColor[];

/** The theme for a challenge, defaulting to Ember (the original look). */
export function challengeTheme(cfg: ChallengeConfig): ChallengeTheme {
  return CHALLENGE_THEMES[cfg.color ?? "ember"] ?? CHALLENGE_THEMES.ember;
}

export interface ChallengeConfig {
  title: string;
  startDate: string; // YYYY-MM-DD, local
  totalDays: number;
  /** Optional existing goal this challenge tracks. With no explicit habits
   *  set, adherence narrows to that goal's daily habits. */
  goalId?: string;
  /** What this challenge is for, written in freehand. A challenge doesn't
   *  need a goal row behind it — "get my mornings back" is a fine reason. */
  customGoal?: string;
  /** The habits this challenge holds, chosen explicitly. When set, this *is*
   *  the challenge — several habits that needn't share a goal or a cadence
   *  ("30-day reinvention" = wake early + two workouts + early bed + hobby). */
  habitIds?: string[];
  /** Banner color theme. Defaults to "ember" (the original fiery look). */
  color?: ChallengeColor;
  /** ISO timestamp, set when the user closes the challenge out themselves.
   *  Absent means not complete: a passed end date only ever reaches "ended". */
  completedAt?: string;
}

const KEY = "alfred.challenge";
export const CHALLENGE_CHANGED = "alfred.challenge:changed";

export const DEFAULT_CHALLENGE: ChallengeConfig = {
  title: "30-Day Hard",
  startDate: "2026-08-16",
  totalDays: 30,
  color: "ember",
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

/** Close the challenge out. Deliberate act, never a side effect of the date
 *  rolling over — the banner asks, the user answers. */
export function completeChallenge(at = new Date()): void {
  const cfg = getChallenge();
  if (cfg.completedAt) return;
  setChallenge({ ...cfg, completedAt: at.toISOString() });
}

/** Undo a completion — a mistaken tap is never a one-way door. */
export function reopenChallenge(): void {
  const cfg = getChallenge();
  if (!cfg.completedAt) return;
  const { completedAt: _dropped, ...rest } = cfg;
  setChallenge(rest);
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

/** "ended" = every day is behind you, but you haven't closed it out yet.
 *  Only the user moves a challenge from "ended" to "complete". */
export type ChallengeState = "upcoming" | "active" | "ended" | "complete";

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

  // The user's own confirmation is the only thing that completes a challenge,
  // so it outranks the calendar in both directions — including a challenge
  // closed out early, which keeps the day it was closed on.
  if (cfg.completedAt) {
    return {
      state: "complete",
      dayNumber: Math.min(cfg.totalDays, Math.max(1, elapsedDays + 1)),
      totalDays: cfg.totalDays,
      daysUntilStart: 0,
      pctElapsed: 1,
    };
  }

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
      state: "ended",
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
 * The habits this challenge tracks, in order of how specific the answer is:
 *
 *  1. Hand-picked habits, when the user chose them. Any cadence, related or
 *     not — the whole point is that one challenge can hold several habits
 *     that share nothing but the month you're doing them in. Kept in the
 *     order they were picked.
 *  2. A linked goal's daily habits — the concrete repeatable actions that
 *     move it, so the challenge measures something specific.
 *  3. Otherwise every non-archived daily habit: the whole routine.
 */
export function challengeHabits(cfg: ChallengeConfig, habits: Habit[]): Habit[] {
  const live = habits.filter((h) => !h.archived);

  if (cfg.habitIds && cfg.habitIds.length > 0) {
    const byId = new Map(live.map((h) => [h.id, h]));
    return cfg.habitIds
      .map((id) => byId.get(id))
      .filter((h): h is Habit => h !== undefined);
  }

  return live.filter(
    (h) => h.cadence === "daily" && (!cfg.goalId || h.goalId === cfg.goalId),
  );
}

/** True when the challenge tracks a hand-picked set rather than a whole routine. */
export function hasPickedHabits(cfg: ChallengeConfig): boolean {
  return !!cfg.habitIds && cfg.habitIds.length > 0;
}

/** What this challenge is for, however the user expressed it. */
export function challengeGoalLabel(cfg: ChallengeConfig, goals: { id: string; title: string }[]): string | null {
  if (cfg.customGoal?.trim()) return cfg.customGoal.trim();
  return goals.find((g) => g.id === cfg.goalId)?.title ?? null;
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

  const tracked = challengeHabits(cfg, habits);
  // Recurring blocks stand in for "the rest of the routine". Once a challenge
  // names what it's about — a goal, or a hand-picked set — they aren't part of
  // it, since a calendar block isn't attributable to either.
  const enabledTemplates =
    cfg.goalId || hasPickedHabits(cfg) ? [] : templates.filter((t) => t.enabled);

  let completed = 0;
  let applicable = 0;

  // Habits count per period, not per day: a daily habit still means one
  // chance each day, but a weekly one picked into a challenge is one chance a
  // week, not seven misses. A period only partly inside the window still
  // counts once — you had some of it.
  for (const h of tracked) {
    const done = completedPeriods(h, habitLogs);
    const seen = new Set<string>();
    for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const key = periodKey(h.cadence, cursor);
      if (seen.has(key)) continue;
      seen.add(key);
      applicable++;
      if (done.has(key)) completed++;
    }
  }

  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const dateStr = todayKey(cursor);
    for (const t of enabledTemplates) {
      if (!isApplicableToDate(t, cursor)) continue;
      applicable++;
      if (completions[`${t.id}:${dateStr}`]) completed++;
    }
  }

  return { completed, applicable, pct: applicable > 0 ? completed / applicable : 0 };
}
