// Retime suggester for recurring schedule blocks — pure heuristics, no LLM.
// Looks at when a block was actually ticked over its recent history vs. when
// it was scheduled, and if there's a consistent, meaningful gap, proposes
// moving the block. The user always taps to accept or dismiss — see
// SuggestedRetimes.tsx and alfredAdapt.ts ("block-retime" decisions).

import { todayKey, weekKey } from "./alfred";
import {
  isApplicableToDate,
  templateDurationMinutes,
  type RecurringTemplate,
} from "./recurring";

/** Need at least this many completed-with-a-time samples before suggesting anything. */
const MIN_SAMPLES = 4;
/** How many recent applicable days to look back over. */
const LOOKBACK_DAYS = 14;
/** Ignore drift smaller than this — not worth a suggestion. */
const MIN_OFFSET_MINUTES = 15;
/** At least this fraction of samples must agree on direction (early vs. late). */
const CONSISTENCY_THRESHOLD = 0.7;

export interface RetimeSuggestion {
  templateId: string;
  title: string;
  currentStart: string; // "HH:MM"
  currentEnd: string;
  suggestedStart: string;
  suggestedEnd: string;
  /** Average minutes late (positive) or early (negative) across the sample. */
  avgOffsetMinutes: number;
  sampleSize: number;
  dedupeKey: string;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(totalMinutes: number): string {
  const m = ((totalMinutes % 1440) + 1440) % 1440; // wrap into a single day
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Round to the nearest 5 minutes — suggestions should read like a human picked them. */
function roundTo5(n: number): number {
  return Math.round(n / 5) * 5;
}

export function suggestRetimes(
  templates: RecurringTemplate[],
  completions: Record<string, true>,
  completionTimes: Record<string, number>,
  now: Date = new Date(),
): RetimeSuggestion[] {
  const suggestions: RetimeSuggestion[] = [];
  const wk = weekKey(now);

  for (const t of templates) {
    if (!t.enabled) continue;
    const scheduledMinutes = toMinutes(t.startTime);
    const offsets: number[] = [];

    // Walk backward day by day until we've checked LOOKBACK_DAYS applicable days.
    let checked = 0;
    for (let i = 1; checked < LOOKBACK_DAYS && i <= LOOKBACK_DAYS * 2; i++) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      if (!isApplicableToDate(t, day)) continue;
      checked++;

      const dateStr = todayKey(day);
      const key = `${t.id}:${dateStr}`;
      if (!completions[key]) continue;
      const ts = completionTimes[key];
      if (ts === undefined) continue;

      const actual = new Date(ts);
      const actualMinutes = actual.getHours() * 60 + actual.getMinutes();
      offsets.push(actualMinutes - scheduledMinutes);
    }

    if (offsets.length < MIN_SAMPLES) continue;

    const avg = offsets.reduce((a, b) => a + b, 0) / offsets.length;
    if (Math.abs(avg) < MIN_OFFSET_MINUTES) continue;

    const sameDirection = offsets.filter((o) => Math.sign(o) === Math.sign(avg)).length;
    if (sameDirection / offsets.length < CONSISTENCY_THRESHOLD) continue;

    const duration = templateDurationMinutes(t);
    const newStartMinutes = roundTo5(scheduledMinutes + avg);
    const suggestedStart = toHHMM(newStartMinutes);
    const suggestedEnd = toHHMM(newStartMinutes + duration);

    if (suggestedStart === t.startTime) continue;

    suggestions.push({
      templateId: t.id,
      title: t.title,
      currentStart: t.startTime,
      currentEnd: t.endTime,
      suggestedStart,
      suggestedEnd,
      avgOffsetMinutes: Math.round(avg),
      sampleSize: offsets.length,
      dedupeKey: `${t.id}:${wk}:${suggestedStart}`,
    });
  }

  return suggestions;
}
