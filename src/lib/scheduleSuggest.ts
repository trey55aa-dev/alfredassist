// Builds a suggested day schedule from the user's goals, placed into the open
// gaps around whatever is already on their calendar (manual / Google / Outlook /
// recurring). Pure + deterministic so it's easy to test and reason about.

import type { AgendaEvent } from "./agenda";
import { type Goal, daysUntil, goalEmoji } from "./goals";
import { paceHint } from "./goalDaily";

export interface SuggestedBlock {
  title: string;
  start: string; // ISO
  end: string;   // ISO
  emoji: string;
  calendarColor: string;
  description?: string;
  goalId: string;
}

const CATEGORY_COLOR: Record<string, string> = {
  Body: "hsl(175 55% 45%)",
  Career: "hsl(45 80% 55%)",
  Money: "hsl(150 40% 55%)",
  Skills: "hsl(200 70% 60%)",
  Life: "hsl(350 70% 60%)",
};

export interface SuggestOptions {
  date?: Date;
  now?: Date;
  dayStartHour?: number; // default 8
  dayEndHour?: number;   // default 21
  blockMinutes?: number; // default 45
  bufferMinutes?: number; // default 15
  maxBlocks?: number;    // default 5
}

function atHour(date: Date, hour: number, min = 0): Date {
  const d = new Date(date);
  d.setHours(hour, min, 0, 0);
  return d;
}

function ceilTo(date: Date, stepMin: number): Date {
  const ms = stepMin * 60000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

/** Prioritized goal work items — nearest deadline first. */
function workItems(goals: Goal[]): { goal: Goal; title: string; desc?: string }[] {
  const active = goals.filter((g) => !g.done);
  const sorted = [...active].sort((a, b) => {
    const da = daysUntil(a.deadline);
    const db = daysUntil(b.deadline);
    if (da != null && db != null) return da - db;
    if (da != null) return -1;
    if (db != null) return 1;
    return 0;
  });
  return sorted.map((g) => {
    const nextStep = (g.subSteps ?? []).find((s) => !s.done);
    if (nextStep) {
      return { goal: g, title: `${g.title}: ${nextStep.title}`, desc: nextStep.detail };
    }
    const hint = paceHint(g);
    return {
      goal: g,
      title: hint ? g.title : `Work on ${g.title}`,
      desc: hint ?? g.survey?.vision ?? undefined,
    };
  });
}

/** Free [start,end) gaps within the window, excluding timed (non-all-day) events. */
function freeGaps(
  events: AgendaEvent[],
  windowStart: Date,
  windowEnd: Date,
): { start: Date; end: Date }[] {
  const busy = events
    .filter((e) => !e.allDay)
    .map((e) => ({ s: new Date(e.start), e: new Date(e.end) }))
    .filter((b) => b.e > windowStart && b.s < windowEnd)
    .sort((a, b) => a.s.getTime() - b.s.getTime());

  const gaps: { start: Date; end: Date }[] = [];
  let cursor = new Date(windowStart);
  for (const b of busy) {
    if (b.s.getTime() > cursor.getTime()) {
      gaps.push({
        start: new Date(cursor),
        end: new Date(Math.min(b.s.getTime(), windowEnd.getTime())),
      });
    }
    if (b.e.getTime() > cursor.getTime()) cursor = new Date(b.e);
    if (cursor.getTime() >= windowEnd.getTime()) break;
  }
  if (cursor.getTime() < windowEnd.getTime()) {
    gaps.push({ start: new Date(cursor), end: new Date(windowEnd) });
  }
  return gaps.filter((g) => g.end.getTime() > g.start.getTime());
}

export function suggestSchedule(
  goals: Goal[],
  events: AgendaEvent[],
  opts: SuggestOptions = {},
): SuggestedBlock[] {
  const date = opts.date ?? new Date();
  const now = opts.now ?? new Date();
  const dayStartHour = opts.dayStartHour ?? 8;
  const dayEndHour = opts.dayEndHour ?? 21;
  const blockMin = opts.blockMinutes ?? 45;
  const bufferMin = opts.bufferMinutes ?? 15;
  const maxBlocks = opts.maxBlocks ?? 5;

  let windowStart = atHour(date, dayStartHour);
  const windowEnd = atHour(date, dayEndHour);
  const isToday = date.toDateString() === now.toDateString();
  if (isToday && now.getTime() > windowStart.getTime()) windowStart = ceilTo(now, 15);
  if (windowStart.getTime() >= windowEnd.getTime()) return [];

  const items = workItems(goals);
  if (items.length === 0) return [];

  const gaps = freeGaps(events, windowStart, windowEnd);
  const blocks: SuggestedBlock[] = [];
  const blockMs = blockMin * 60000;
  const bufMs = bufferMin * 60000;
  let idx = 0;

  for (const gap of gaps) {
    let cursor = gap.start.getTime();
    while (idx < items.length && blocks.length < maxBlocks && cursor + blockMs <= gap.end.getTime()) {
      const item = items[idx++];
      blocks.push({
        title: item.title,
        start: new Date(cursor).toISOString(),
        end: new Date(cursor + blockMs).toISOString(),
        emoji: goalEmoji(item.goal),
        calendarColor: CATEGORY_COLOR[item.goal.category] ?? "hsl(45 80% 55%)",
        description: item.desc,
        goalId: item.goal.id,
      });
      cursor += blockMs + bufMs;
    }
    if (blocks.length >= maxBlocks || idx >= items.length) break;
  }
  return blocks;
}
