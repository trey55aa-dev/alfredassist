// Merges today's scheduled blocks + relevant habits into one chronological,
// crossed-off list — "everything I accomplished today" — and formats it as
// plain text for pasting into Notes, Reminders, or a calendar event.

import { todayKey } from "./alfred";
import type { AgendaEvent } from "./agenda";
import { timeKey, type Habit, type HabitLog } from "./habits";

export interface RecapItem {
  id: string;
  title: string;
  kind: "event" | "habit";
  done: boolean;
  /** ms since epoch — when it was scheduled for (events only). */
  scheduledMs?: number;
  /** ms since epoch — when it was actually ticked, if known. */
  actualMs?: number;
}

/** Build today's recap list. Habits: daily ones always show; other cadences
 *  only show once they've actually been logged today, so a weekly habit like
 *  "Church" doesn't clutter every day it isn't due. */
export function buildRecapItems(
  events: AgendaEvent[],
  habits: Habit[],
  habitLogs: HabitLog[],
  habitTimes: Record<string, number>,
  date = new Date(),
): RecapItem[] {
  const dateStr = todayKey(date);

  const eventItems: RecapItem[] = events
    .filter((e) => !e.allDay)
    .map((e) => ({
      id: e.id,
      title: e.title,
      kind: "event" as const,
      done: !!e.completed,
      scheduledMs: new Date(e.start).getTime(),
      actualMs: e.completedAt,
    }));

  const loggedToday = new Set(
    habitLogs.filter((l) => l.date === dateStr).map((l) => l.habitId),
  );

  const habitItems: RecapItem[] = habits
    .filter((h) => !h.archived && (h.cadence === "daily" || loggedToday.has(h.id)))
    .map((h) => {
      const done = loggedToday.has(h.id);
      return {
        id: h.id,
        title: h.title,
        kind: "habit" as const,
        done,
        actualMs: done ? habitTimes[timeKey(h.id, dateStr)] : undefined,
      };
    });

  return [...eventItems, ...habitItems].sort((a, b) => {
    const av = a.actualMs ?? a.scheduledMs ?? Infinity;
    const bv = b.actualMs ?? b.scheduledMs ?? Infinity;
    return av - bv;
  });
}

export type RecapStyle = "checklist" | "accomplished" | "withNote";

function fmtTime(ms?: number): string {
  if (ms === undefined) return "";
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Plain-text rendering suitable for pasting into Notes / Reminders / a
 *  calendar event description. Kept dependency-free (no markdown/HTML). */
export function formatRecapText(
  items: RecapItem[],
  style: RecapStyle,
  dateLabel: string,
  feedback?: string,
): string {
  const lines: string[] = [dateLabel, ""];

  if (style === "accomplished") {
    const done = items.filter((i) => i.done);
    if (done.length === 0) {
      lines.push("Nothing logged yet.");
    } else {
      for (const i of done) {
        const t = fmtTime(i.actualMs);
        lines.push(`• ${i.title}${t ? ` (${t})` : ""}`);
      }
    }
  } else {
    for (const i of items) {
      const mark = i.done ? "✓" : "☐";
      const t = fmtTime(i.done ? i.actualMs : i.scheduledMs);
      lines.push(`${mark} ${t ? `${t} — ` : ""}${i.title}`);
    }
  }

  if (style === "withNote" && feedback?.trim()) {
    lines.push("", "Notes:", feedback.trim());
  }

  return lines.join("\n");
}
