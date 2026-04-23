// Local agenda events — persisted per browser. Seamlessly merge with future
// Google/Apple calendar sources via getTodayEvents().

import { AgendaEvent } from "./agenda";

export const LOCAL_EVENTS_KEY = "alfred.agenda.events";
export const LOCAL_EVENTS_CHANGED = "alfred.agenda.events:changed";

function safeParse(raw: string | null): AgendaEvent[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AgendaEvent[]) : [];
  } catch {
    return [];
  }
}

export function loadLocalEvents(): AgendaEvent[] {
  if (typeof window === "undefined") return [];
  return safeParse(localStorage.getItem(LOCAL_EVENTS_KEY));
}

export function saveLocalEvents(events: AgendaEvent[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(events));
  window.dispatchEvent(new Event(LOCAL_EVENTS_CHANGED));
}

export function addLocalEvent(event: AgendaEvent): void {
  saveLocalEvents([...loadLocalEvents(), event]);
}

export function removeLocalEvent(id: string): void {
  saveLocalEvents(loadLocalEvents().filter((e) => e.id !== id));
}

export function updateLocalEvent(
  id: string,
  patch: Partial<Omit<AgendaEvent, "id" | "source">>,
): AgendaEvent | null {
  const events = loadLocalEvents();
  let updated: AgendaEvent | null = null;
  const next = events.map((e) => {
    if (e.id !== id) return e;
    updated = { ...e, ...patch };
    return updated;
  });
  if (updated) saveLocalEvents(next);
  return updated;
}

export function toggleEventCompleted(id: string): AgendaEvent | null {
  const ev = loadLocalEvents().find((e) => e.id === id);
  if (!ev) return null;
  return updateLocalEvent(id, { completed: !ev.completed });
}

/** Count of events completed today (across all sources stored locally). */
export function countCompletedToday(now = new Date()): number {
  const day = now.toDateString();
  return loadLocalEvents().filter((e) => {
    if (!e.completed) return false;
    return new Date(e.start).toDateString() === day;
  }).length;
}
