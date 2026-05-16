// Agenda / calendar event types and helpers.
// Once Google Calendar OAuth is wired, swap `getTodayEvents` to fetch from the edge function.

export type EventSource = "google" | "apple" | "manual";

export interface AgendaEvent {
  id: string;
  title: string;
  /** ISO start time. All-day events use the date at 00:00 local. */
  start: string;
  /** ISO end time. */
  end: string;
  allDay?: boolean;
  location?: string;
  description?: string;
  source: EventSource;
  /** Optional hex/HSL accent for the calendar it came from. */
  calendarColor?: string;
  calendarName?: string;
  /** Optional single emoji for visual scanning in the timeline view. */
  emoji?: string;
  /** Marked complete by the user — drives the ambient pattern intensity. */
  completed?: boolean;
  /** ISO date (YYYY-MM-DD) the event was originally scheduled for, if it has been carried over. */
  originalDate?: string;
  /** How many times this event has been carried forward (0 if never). */
  carryCount?: number;
  /** Estimated minutes to complete (overrides scheduled duration as the "how long will this take" guess). */
  estimatedMinutes?: number;
  /** Accumulated minutes actually spent on this task across timer sessions. */
  actualMinutes?: number;
}

/** Curated palette + emojis for the Tiimo-style timeline. */
export const EVENT_COLORS: { name: string; hsl: string }[] = [
  { name: "Gold", hsl: "45 80% 55%" },
  { name: "Teal", hsl: "175 55% 45%" },
  { name: "Rose", hsl: "350 70% 60%" },
  { name: "Sky", hsl: "200 70% 60%" },
  { name: "Sage", hsl: "150 40% 55%" },
  { name: "Amber", hsl: "30 85% 60%" },
  { name: "Violet", hsl: "270 55% 65%" },
  { name: "Slate", hsl: "220 15% 55%" },
];

export const EVENT_EMOJIS = [
  "🎯", "💪", "📚", "🧠", "💼", "☕", "🍳", "🏃",
  "🧘", "🎨", "🛠️", "💰", "📞", "✈️", "❤️", "🌿",
  "📝", "🔥", "🎵", "💻",
];

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Filter to events that intersect with the given day. */
export function filterToDay(events: AgendaEvent[], day = new Date()): AgendaEvent[] {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);

  return events.filter((e) => {
    const s = new Date(e.start);
    const en = new Date(e.end);
    if (e.allDay) return sameDay(s, day);
    return en >= dayStart && s <= dayEnd;
  });
}

/** Sort by start time (all-day first). */
export function sortByStart(events: AgendaEvent[]): AgendaEvent[] {
  return [...events].sort((a, b) => {
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    return new Date(a.start).getTime() - new Date(b.start).getTime();
  });
}

export function formatEventTime(e: AgendaEvent): string {
  if (e.allDay) return "All day";
  const fmt = (d: Date) =>
    d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${fmt(new Date(e.start))} – ${fmt(new Date(e.end))}`;
}

export function durationMinutes(e: AgendaEvent): number {
  return Math.max(
    0,
    Math.round((new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000),
  );
}

/** Find the next event starting after `now`. */
export function nextEvent(events: AgendaEvent[], now = new Date()): AgendaEvent | null {
  const upcoming = sortByStart(events).filter(
    (e) => !e.allDay && new Date(e.start).getTime() > now.getTime(),
  );
  return upcoming[0] ?? null;
}

/** Event currently in progress, if any. */
export function currentEvent(events: AgendaEvent[], now = new Date()): AgendaEvent | null {
  return (
    events.find((e) => {
      if (e.allDay) return false;
      const s = new Date(e.start).getTime();
      const en = new Date(e.end).getTime();
      return s <= now.getTime() && now.getTime() < en;
    }) ?? null
  );
}

/**
 * Today's events. Merges locally-stored manual events with Google Calendar
 * events when connected. Google failures are swallowed (logged) so a flaky
 * network never blocks the local timeline.
 */
export async function getTodayEvents(day = new Date()): Promise<AgendaEvent[]> {
  const { loadLocalEvents } = await import("./agendaStore");
  const local = loadLocalEvents();

  const { isGoogleConnected, listGoogleEventsForDay } = await import(
    "./googleCalendar"
  );
  if (!isGoogleConnected()) return local;

  try {
    const remote = await listGoogleEventsForDay(day);
    // Local events with source !== "google" win on id collision (shouldn't happen
    // since Google ids are prefixed "gcal:"). Otherwise we trust Google's copy
    // for `gcal:*` ids and the local cache for everything else.
    const byId = new Map<string, AgendaEvent>();
    for (const e of remote) byId.set(e.id, e);
    for (const e of local) {
      if (e.source === "google" && byId.has(e.id)) {
        // Preserve any local-only completed flag we cached.
        const remoteCopy = byId.get(e.id)!;
        byId.set(e.id, { ...remoteCopy, completed: e.completed ?? remoteCopy.completed });
      } else {
        byId.set(e.id, e);
      }
    }
    return Array.from(byId.values());
  } catch (err) {
    console.warn("[alfred] Google Calendar fetch failed:", err);
    return local;
  }
}
