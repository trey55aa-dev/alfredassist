// One timestamped record per thing-completed per day, across every kind of
// completable thing Alfred has.
//
// The pieces existed but were scattered and shaped differently: habit ticks
// kept `{habitId|date: ms}`, recurring blocks kept `{templateId:date: ms}`,
// events carried `completedAt` on the row, goal sub-steps their own field.
// Nothing could answer "when does this person actually do things?" without
// knowing all four shapes.
//
// This is that one shape. It's append-only and additive — the existing maps
// still work exactly as before, and this is backfilled from them on start, so
// no history is lost and nothing depends on a migration.
//
// The point is what it enables: completion *times*, per item, over weeks —
// the input a smart notification schedule needs to say "you usually do this
// around 7am, so nudging you at noon is pointless."

import { todayKey } from "./alfred";

export type CompletionKind = "habit" | "event" | "recurring" | "goalStep";

export interface CompletionRecord {
  kind: CompletionKind;
  /** Habit id, event id, recurring template id, or sub-step id. */
  itemId: string;
  /** Local day the completion counts for — YYYY-MM-DD. */
  date: string;
  /** Epoch ms of when it was actually marked done. */
  at: number;
}

export const COMPLETION_LOG_KEY = "alfred.completionLog";
export const COMPLETION_LOG_CHANGED = "alfred.completionLog:changed";

/** Below this, "when do you usually do it" is noise rather than a pattern. */
const MIN_SAMPLES_FOR_PATTERN = 3;

const recordKey = (kind: CompletionKind, itemId: string, date: string) =>
  `${kind}|${itemId}|${date}`;

function readRaw(): CompletionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(COMPLETION_LOG_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is CompletionRecord =>
        !!r &&
        typeof r === "object" &&
        typeof r.itemId === "string" &&
        typeof r.date === "string" &&
        typeof r.at === "number" &&
        Number.isFinite(r.at),
    );
  } catch {
    return [];
  }
}

function write(records: CompletionRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COMPLETION_LOG_KEY, JSON.stringify(records));
  } catch {
    /* quota */
  }
  window.dispatchEvent(new Event(COMPLETION_LOG_CHANGED));
}

/**
 * Every record, one per item-day, oldest first.
 *
 * Deduped on read rather than on write: the cloud layer union-merges arrays,
 * so two devices that both recorded the same tick (at slightly different
 * milliseconds) would otherwise leave two records for one completion and skew
 * the hour stats. The earliest timestamp wins — the moment you first did it.
 */
export function loadCompletions(): CompletionRecord[] {
  const byKey = new Map<string, CompletionRecord>();
  for (const r of readRaw()) {
    const k = recordKey(r.kind, r.itemId, r.date);
    const existing = byKey.get(k);
    if (!existing || r.at < existing.at) byKey.set(k, r);
  }
  return [...byKey.values()].sort((a, b) => a.at - b.at);
}

/** Note that something was completed. Idempotent per item-day. */
export function recordCompletion(
  kind: CompletionKind,
  itemId: string,
  at: Date = new Date(),
  date = todayKey(at),
): void {
  const records = readRaw();
  const k = recordKey(kind, itemId, date);
  if (records.some((r) => recordKey(r.kind, r.itemId, r.date) === k)) return;
  write([...records, { kind, itemId, date, at: at.getTime() }]);
}

/** Undo a completion — unticking must leave no trace in the stats. */
export function clearCompletion(
  kind: CompletionKind,
  itemId: string,
  date = todayKey(),
): void {
  const records = readRaw();
  const k = recordKey(kind, itemId, date);
  const next = records.filter((r) => recordKey(r.kind, r.itemId, r.date) !== k);
  if (next.length !== records.length) write(next);
}

/** Every recorded completion of one item, oldest first. */
export function completionsFor(kind: CompletionKind, itemId: string): CompletionRecord[] {
  return loadCompletions().filter((r) => r.kind === kind && r.itemId === itemId);
}

/**
 * The hour of day this item usually gets done, or null if there isn't enough
 * history to call it a pattern. Median rather than mean so one 3am outlier
 * doesn't drag a consistent morning habit into the afternoon.
 */
export function typicalCompletionHour(
  kind: CompletionKind,
  itemId: string,
): number | null {
  const hours = completionsFor(kind, itemId)
    .map((r) => new Date(r.at).getHours())
    .sort((a, b) => a - b);
  if (hours.length < MIN_SAMPLES_FOR_PATTERN) return null;
  return hours[Math.floor(hours.length / 2)];
}

/**
 * Pull the pre-existing per-kind timestamp maps into the unified log.
 *
 * Runs on every start rather than once: the maps sync across devices
 * independently, so history that arrives later still finds its way in. Cheap
 * and idempotent — existing item-days are left alone.
 */
export function backfillCompletionLog(
  habitTimes: Record<string, number>,
  recurringTimes: Record<string, number>,
): number {
  const records = readRaw();
  const seen = new Set(records.map((r) => recordKey(r.kind, r.itemId, r.date)));
  const additions: CompletionRecord[] = [];

  const absorb = (kind: CompletionKind, rawKey: string, at: number, sep: string) => {
    const idx = rawKey.lastIndexOf(sep);
    if (idx <= 0) return;
    const itemId = rawKey.slice(0, idx);
    const date = rawKey.slice(idx + sep.length);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    if (!Number.isFinite(at)) return;
    const k = recordKey(kind, itemId, date);
    if (seen.has(k)) return;
    seen.add(k);
    additions.push({ kind, itemId, date, at });
  };

  // Habit times key on `${habitId}|${date}`, recurring on `${templateId}:${date}`.
  for (const [k, at] of Object.entries(habitTimes ?? {})) absorb("habit", k, at, "|");
  for (const [k, at] of Object.entries(recurringTimes ?? {})) absorb("recurring", k, at, ":");

  if (additions.length > 0) write([...records, ...additions]);
  return additions.length;
}
