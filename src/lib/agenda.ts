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
}

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
 * Today's events. For now returns an empty list — the UI handles the
 * "calendar not connected" case gracefully. Replace with a live fetch
 * once the Google Calendar OAuth flow is in place.
 */
export async function getTodayEvents(): Promise<AgendaEvent[]> {
  return [];
}
