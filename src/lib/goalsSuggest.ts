// Weekly micro-task suggester. Pure heuristics — no LLM call — so it works
// instantly + offline. Each open goal produces one short "do X by Sunday"
// nudge that the user can one-tap into the agenda.
//
// Quantitative goals (target + unit set): suggest a numeric stretch from where
// they are now to a sensible weekly milestone, sized by the required pace
// to hit the deadline.
// Qualitative goals: a templated "make one concrete move on …" line.

import type { Goal } from "./goals";
import { computeProjection } from "./goalsHistory";
import { weekKey } from "./alfred";

const SUGGESTIONS_ADDED_KEY = "alfred.goals.suggestionsAdded";

export interface SuggestedNext {
  /** Short line shown on the goal card. */
  headline: string;
  /** Pace assessment line, e.g. "On pace · 0.8 reps/day needed". */
  rationale: string;
  /** The text that becomes the event title when added to the agenda. */
  taskTitle: string;
  /** Suggested due date (next Sunday at 09:00 local). */
  dueDate: Date;
  /** Stable id used for week-level dedupe ("goalId:weekKey:slug"). */
  dedupeKey: string;
  /** Quantitative vs qualitative — drives a small icon/tone difference. */
  kind: "quantitative" | "qualitative";
  /** "ahead" / "on_pace" / "behind" / "behind_critical" / "missing"
   *  — mirrors goalsHistory.computeProjection() and tints the headline. */
  status: "ahead" | "on_pace" | "behind" | "behind_critical" | "missing";
}

/** Next Sunday at 09:00 local time. If today is Sunday and it's still morning,
 *  uses *this* Sunday; otherwise the upcoming one. */
function nextSunday(now: Date): Date {
  const d = new Date(now);
  const day = d.getDay(); // 0 = Sun
  const todayIsSunday = day === 0;
  const advance = todayIsSunday && d.getHours() < 12 ? 0 : (7 - day) % 7 || 7;
  d.setDate(d.getDate() + advance);
  d.setHours(9, 0, 0, 0);
  return d;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Pick a sensible rounding bucket given the magnitude of the weekly delta. */
function roundDelta(raw: number): number {
  if (raw <= 0) return 0;
  if (raw < 1) return 1;
  if (raw < 10) return Math.round(raw);
  if (raw < 100) return Math.ceil(raw / 5) * 5; // nearest $5 / 5 reps
  if (raw < 1000) return Math.ceil(raw / 10) * 10; // nearest $10
  if (raw < 10000) return Math.ceil(raw / 50) * 50; // nearest $50
  return Math.ceil(raw / 100) * 100; // big-ticket: $100 buckets
}

/** Format a value with the goal's unit, handling money-shaped units gracefully. */
function fmt(value: number, unit?: string): string {
  if (!unit) return `${value}`;
  const u = unit.trim();
  // Detect money: unit is "$" or starts with "$" or matches usd/eur/gbp/etc.
  if (u === "$" || u.startsWith("$") || /^(usd|eur|gbp|cad|jpy)$/i.test(u)) {
    return `$${value.toLocaleString()}`;
  }
  return `${value} ${u}`;
}

function deadlineLabel(goal: Goal, now: Date): string {
  if (goal.deadline) {
    const d = new Date(goal.deadline);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  if (goal.quarter) {
    const yr = now.getFullYear();
    const map: Record<string, string> = {
      Q1: `Mar 31, ${yr}`,
      Q2: `Jun 30, ${yr}`,
      Q3: `Sep 30, ${yr}`,
      Q4: `Dec 31, ${yr}`,
    };
    return map[goal.quarter] ?? `end of ${yr}`;
  }
  return `end of ${now.getFullYear()}`;
}

interface WeeklyAsk {
  suggestedTotal: number;
  deltaThisWeek: number;
}

/** Compute the weekly stretch target for a quantitative goal, using the
 *  REQUIRED pace to the deadline. Never inflates from a noisy actual rate. */
function quantitativeMilestone(
  goal: Goal,
  now: Date,
): WeeklyAsk | null {
  if (typeof goal.target !== "number" || goal.target <= 0) return null;
  const current = goal.current ?? 0;
  if (current >= goal.target) return null;

  const projection = computeProjection(goal, now);
  const required = projection.requiredDailyRate ?? null;
  if (required === null) return null;

  const headroom = goal.target - current;
  const weeklyRaw = required * 7;
  let delta = roundDelta(weeklyRaw);

  // "Already ahead": the required weekly amount is essentially zero, no
  // need to push this week. Caller can still show a qualitative nudge.
  if (delta <= 0) return null;

  delta = Math.min(delta, headroom);
  return { suggestedTotal: current + delta, deltaThisWeek: delta };
}

export function suggestNext(goal: Goal, now: Date = new Date()): SuggestedNext | null {
  if (goal.done) return null;
  const due = nextSunday(now);
  const wk = weekKey(now);
  const projection = computeProjection(goal, now);
  const status = (
    projection.status === "ahead" ||
    projection.status === "on_pace" ||
    projection.status === "behind" ||
    projection.status === "behind_critical" ||
    projection.status === "missing"
      ? projection.status
      : "on_pace"
  ) as SuggestedNext["status"];

  const q = quantitativeMilestone(goal, now);
  if (q) {
    const current = goal.current ?? 0;
    const targetLabel = fmt(goal.target!, goal.unit);
    const totalLabel = fmt(q.suggestedTotal, goal.unit);
    const deltaLabel = fmt(q.deltaThisWeek, goal.unit);
    const dl = deadlineLabel(goal, now);

    const verb =
      status === "behind" || status === "behind_critical" || status === "missing"
        ? "to catch up to"
        : "to stay on pace for";

    const headline = `Hit ${totalLabel} by Sunday — that's +${deltaLabel} from today's ${fmt(current, goal.unit)}, ${verb} ${targetLabel} by ${dl}.`;
    const rationale =
      projection.label && projection.detail
        ? `${projection.label} · ${projection.detail}`
        : projection.label || "";
    const taskTitle = `${goal.title}: hit ${totalLabel}`;
    return {
      headline,
      rationale,
      taskTitle,
      dueDate: due,
      dedupeKey: `${goal.id}:${wk}:${slugify(taskTitle)}`,
      kind: "quantitative",
      status,
    };
  }

  // Qualitative fallback — keep it concrete and tied to the goal's words.
  const headline = `Take one concrete step on "${goal.title}" this week.`;
  const rationale = projection.label || "";
  const taskTitle = `${goal.title}: weekly action`;
  return {
    headline,
    rationale,
    taskTitle,
    dueDate: due,
    dedupeKey: `${goal.id}:${wk}:${slugify(taskTitle)}`,
    kind: "qualitative",
    status,
  };
}

/* ---------- per-week idempotency ---------- */

function loadAdded(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SUGGESTIONS_ADDED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function saveAdded(set: Set<string>): void {
  if (typeof window === "undefined") return;
  // Cap at 1000 entries; old weeks naturally fall off the active surface.
  const arr = Array.from(set).slice(-1000);
  localStorage.setItem(SUGGESTIONS_ADDED_KEY, JSON.stringify(arr));
}

export function isSuggestionAdded(key: string): boolean {
  return loadAdded().has(key);
}

export function markSuggestionAdded(key: string): void {
  const set = loadAdded();
  set.add(key);
  saveAdded(set);
}
