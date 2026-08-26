// Merges today's scheduled blocks + relevant habits into one chronological,
// crossed-off list — "everything I accomplished today" — and formats it as
// plain text for pasting into Notes, Reminders, or a calendar event.

import { todayKey } from "./alfred";
import type { AgendaEvent } from "./agenda";
import { timeKey, type Habit, type HabitLog } from "./habits";
import { isAnsweredToday, type GoalDailyTarget, type TargetLog } from "./goalTargets";

export type RecapKind = "event" | "habit" | "target";

/** Which block of the recap an item belongs under. */
export type RecapGroup = "schedule" | "habits" | "subgoals";

export const RECAP_GROUP_LABEL: Record<RecapGroup, string> = {
  schedule: "Schedule",
  habits: "Habits",
  subgoals: "Sub-goals",
};

/** Groups in the order they're shown — time-bound first, then the rest. */
export const RECAP_GROUPS: RecapGroup[] = ["schedule", "habits", "subgoals"];

export interface RecapItem {
  id: string;
  title: string;
  kind: RecapKind;
  group: RecapGroup;
  done: boolean;
  /** ms since epoch — when it was scheduled for (events only). */
  scheduledMs?: number;
  /** ms since epoch — when it was actually ticked, if known. */
  actualMs?: number;
}

const KIND_GROUP: Record<RecapKind, RecapGroup> = {
  event: "schedule",
  habit: "habits",
  target: "subgoals",
};

/** Build today's recap list. Habits: daily ones always show; other cadences
 *  only show once they've actually been logged today, so a weekly habit like
 *  "Church" doesn't clutter every day it isn't due. */
export function buildRecapItems(
  events: AgendaEvent[],
  habits: Habit[],
  habitLogs: HabitLog[],
  habitTimes: Record<string, number>,
  date = new Date(),
  targets: GoalDailyTarget[] = [],
  targetLog: TargetLog = {},
): RecapItem[] {
  const dateStr = todayKey(date);

  const eventItems: RecapItem[] = events
    .filter((e) => !e.allDay)
    .map((e) => ({
      id: e.id,
      title: e.title,
      kind: "event" as const,
      group: KIND_GROUP.event,
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
        group: KIND_GROUP.habit,
        done,
        actualMs: done ? habitTimes[timeKey(h.id, dateStr)] : undefined,
      };
    });

  // Daily sub-goals — the small repeatable ask hanging off a 2026 goal. They're
  // part of what today actually demanded, so they belong in the same recap.
  const targetItems: RecapItem[] = targets
    .filter((t) => !t.archived)
    .map((t) => ({
      id: t.id,
      title: t.title,
      kind: "target" as const,
      group: KIND_GROUP.target,
      done: isAnsweredToday(t, targetLog, dateStr),
    }));

  return [...eventItems, ...habitItems, ...targetItems].sort((a, b) => {
    const av = a.actualMs ?? a.scheduledMs ?? Infinity;
    const bv = b.actualMs ?? b.scheduledMs ?? Infinity;
    return av - bv;
  });
}

/** An item's group, falling back to its kind so a partial item is never dropped. */
export function recapGroupOf(item: RecapItem): RecapGroup {
  return item.group ?? KIND_GROUP[item.kind] ?? "schedule";
}

/** The recap split into its groups, empty ones dropped. */
export function groupRecapItems(
  items: RecapItem[],
): { group: RecapGroup; label: string; items: RecapItem[] }[] {
  return RECAP_GROUPS.map((group) => ({
    group,
    label: RECAP_GROUP_LABEL[group],
    items: items.filter((i) => recapGroupOf(i) === group),
  })).filter((g) => g.items.length > 0);
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
    // Mirror the on-screen grouping so a pasted checklist reads the same way.
    for (const g of groupRecapItems(items)) {
      lines.push(`${g.label}:`);
      for (const i of g.items) {
        const mark = i.done ? "✓" : "☐";
        const t = fmtTime(i.done ? i.actualMs : i.scheduledMs);
        lines.push(`${mark} ${t ? `${t} — ` : ""}${i.title}`);
      }
      lines.push("");
    }
    while (lines[lines.length - 1] === "") lines.pop();
  }

  if (style === "withNote" && feedback?.trim()) {
    lines.push("", "Notes:", feedback.trim());
  }

  return lines.join("\n");
}
