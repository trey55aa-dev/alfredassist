// Steps inside a habit — the small things a routine is actually made of.
//
// "Morning routine" isn't one action, it's brush teeth / water / floss / scrape
// tongue. Tracking it as a single tick hides where it broke down, and asks you
// to hold the list in your head — the exact thing Alfred exists to take off you.
//
// The parent habit and its steps stay in lockstep, in both directions:
//   - tick the last outstanding step  → the habit completes itself
//   - tick the habit ("hit the whole routine") → every step fills in
//   - untick a step on a completed habit  → the habit reopens
//   - untick the habit                → its steps clear
//
// So the tick and the list can never disagree about whether today happened, and
// there's a path back from either side — no state you can get stuck in.

import { todayKey } from "./alfred";
import type { Habit } from "./habits";

export interface HabitStep {
  id: string;
  title: string;
}

/** `${habitId}|${date}` -> ids of the steps ticked that day. */
export type StepTicks = Record<string, string[]>;

export const HABIT_STEPS_KEY = "alfred.habitStepTicks";
export const HABIT_STEPS_CHANGED = "alfred.habitSteps:changed";

export function stepKey(habitId: string, date: string): string {
  return `${habitId}|${date}`;
}

function read(): StepTicks {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(HABIT_STEPS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    // Tolerate a half-written or hand-edited store rather than throwing: drop
    // anything that isn't a list of ids.
    const out: StepTicks = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(v)) out[k] = v.filter((s): s is string => typeof s === "string");
    }
    return out;
  } catch {
    return {};
  }
}

function write(ticks: StepTicks): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HABIT_STEPS_KEY, JSON.stringify(ticks));
  } catch {
    /* quota */
  }
  window.dispatchEvent(new Event(HABIT_STEPS_CHANGED));
}

export function loadStepTicks(): StepTicks {
  return read();
}

/** The live steps of a habit. Empty for a plain habit with no routine. */
export function stepsOf(habit: Habit): HabitStep[] {
  return Array.isArray(habit.steps) ? habit.steps : [];
}

export function hasSteps(habit: Habit): boolean {
  return stepsOf(habit).length > 0;
}

/** Step ids ticked for this habit on this date. */
export function ticksFor(
  ticks: StepTicks,
  habitId: string,
  date = todayKey(),
): string[] {
  return ticks[stepKey(habitId, date)] ?? [];
}

export function isStepDone(
  ticks: StepTicks,
  habitId: string,
  stepId: string,
  date = todayKey(),
): boolean {
  return ticksFor(ticks, habitId, date).includes(stepId);
}

export interface StepProgress {
  done: number;
  total: number;
  /** Every step ticked. False when the habit has no steps at all. */
  allDone: boolean;
}

/**
 * How far through the routine today is. Only counts ticks that match a step the
 * habit still has, so deleting a step doesn't leave the count stuck above the
 * list — "3/2 done" is the kind of number that makes people stop trusting it.
 */
export function stepProgress(
  habit: Habit,
  ticks: StepTicks,
  date = todayKey(),
): StepProgress {
  const steps = stepsOf(habit);
  const ticked = new Set(ticksFor(ticks, habit.id, date));
  const done = steps.filter((s) => ticked.has(s.id)).length;
  return { done, total: steps.length, allDone: steps.length > 0 && done === steps.length };
}

/** What ticking one step does — both to the step list and to the habit itself. */
export interface StepToggleResult {
  ticks: StepTicks;
  /** The habit should now be complete for today (all steps in). */
  habitShouldComplete: boolean;
  /** The habit should reopen — a step came off a finished routine. */
  habitShouldReopen: boolean;
}

/**
 * Toggle one step. `habitWasDone` lets the caller say whether the parent tick is
 * currently on, so this can report the parent transition without reaching into
 * the habit log itself.
 */
export function toggleStep(
  habit: Habit,
  stepId: string,
  habitWasDone: boolean,
  date = todayKey(),
): StepToggleResult {
  const all = read();
  const key = stepKey(habit.id, date);
  const current = all[key] ?? [];
  const wasTicked = current.includes(stepId);
  const next = wasTicked
    ? current.filter((id) => id !== stepId)
    : [...current, stepId];

  if (next.length === 0) delete all[key];
  else all[key] = next;
  write(all);

  const steps = stepsOf(habit);
  const ticked = new Set(next);
  const allDone = steps.length > 0 && steps.every((s) => ticked.has(s.id));

  return {
    ticks: all,
    habitShouldComplete: allDone && !habitWasDone,
    habitShouldReopen: !allDone && habitWasDone && wasTicked,
  };
}

/**
 * Fill in or clear every step at once — what ticking the habit itself means for
 * a routine. Called after the habit's own tick flips.
 */
export function setAllSteps(
  habit: Habit,
  done: boolean,
  date = todayKey(),
): StepTicks {
  const all = read();
  const key = stepKey(habit.id, date);
  if (done) all[key] = stepsOf(habit).map((s) => s.id);
  else delete all[key];
  write(all);
  return all;
}

/** Drop every step tick for a habit — used when the habit itself is deleted. */
export function purgeStepTicks(habitId: string): StepTicks {
  const all = read();
  let touched = false;
  for (const key of Object.keys(all)) {
    if (key.startsWith(`${habitId}|`)) {
      delete all[key];
      touched = true;
    }
  }
  if (touched) write(all);
  return all;
}

/** A short "2/4" style label, or null when the habit isn't a routine. */
export function stepLabel(habit: Habit, ticks: StepTicks, date = todayKey()): string | null {
  const p = stepProgress(habit, ticks, date);
  if (p.total === 0) return null;
  return `${p.done}/${p.total}`;
}

export function newStep(title: string): HabitStep {
  return { id: crypto.randomUUID(), title: title.trim() };
}

/**
 * Parse a one-per-line editor into steps, reusing the id of any step whose
 * title is unchanged. Minting fresh ids on every keystroke would orphan the
 * ticks already made today — you'd watch the routine empty itself as you
 * corrected a typo.
 */
export function stepsFromText(text: string, existing: HabitStep[] = []): HabitStep[] {
  const byTitle = new Map<string, HabitStep[]>();
  for (const s of existing) {
    const list = byTitle.get(s.title) ?? [];
    list.push(s);
    byTitle.set(s.title, list);
  }
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((title) => {
      // Shift so two steps sharing a title keep one id each, not the same one.
      const match = byTitle.get(title)?.shift();
      return match ?? newStep(title);
    });
}

export function stepsToText(steps: HabitStep[]): string {
  return steps.map((s) => s.title).join("\n");
}
