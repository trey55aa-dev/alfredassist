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
