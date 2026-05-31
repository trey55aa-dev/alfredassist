// Local agenda events — manually-created ("Quick Add") events.
//
// Storage model: localStorage is the always-available cache. When a user is
// signed in, every write is mirrored to Supabase (fire-and-forget) and reads
// can be hydrated from the cloud on app load via hydrateEventsFromCloud().
//
// The synchronous function signatures are preserved so the 6+ call sites
// (Agenda, QuickAddEvent, EditEventForm, DayTimeline, carryOver, followUps,
// goalsSuggest) don't need to change.

import { AgendaEvent } from "./agenda";
import {
  bulkUpsertLocalEvents,
  deleteLocalEventCloud,
  loadLocalEventsCloud,
  upsertLocalEventCloud,
} from "./localEventsRepo";

export const LOCAL_EVENTS_KEY = "alfred.agenda.events";
export const LOCAL_EVENTS_CHANGED = "alfred.agenda.events:changed";

const CACHE_OWNER_KEY = "alfred.agenda.cacheOwner";

/* ---------- signed-in user tracking (set by useEventsSync) ---------- */

let cachedUserId: string | null = null;

/** Called by useEventsSync when auth state resolves/changes. */
export function setEventsUserId(userId: string | null): void {
  cachedUserId = userId;
}

function fireAndForget(p: Promise<unknown>): void {
  p.catch((err) => console.warn("[alfred] event cloud sync failed:", err));
}

/* ---------- cache helpers ---------- */

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

/* ---------- mutations (write-through to cloud when signed in) ---------- */

export function addLocalEvent(event: AgendaEvent): void {
  saveLocalEvents([...loadLocalEvents(), event]);
  if (cachedUserId && event.source === "manual") {
    fireAndForget(upsertLocalEventCloud(cachedUserId, event));
  }
}

export function removeLocalEvent(id: string): void {
  const existing = loadLocalEvents().find((e) => e.id === id);
  saveLocalEvents(loadLocalEvents().filter((e) => e.id !== id));
  if (cachedUserId && (!existing || existing.source === "manual")) {
    fireAndForget(deleteLocalEventCloud(cachedUserId, id));
  }
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
  if (updated) {
    saveLocalEvents(next);
    if (cachedUserId && updated.source === "manual") {
      fireAndForget(upsertLocalEventCloud(cachedUserId, updated));
    }
  }
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

/* ---------- cloud hydration + first-sign-in migration ---------- */

function getCacheOwner(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CACHE_OWNER_KEY);
}

function setCacheOwner(userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CACHE_OWNER_KEY, userId);
}

/**
 * Reconcile localStorage manual events with the cloud for `userId`.
 *  - If the local cache belongs to this user (or to no one yet) and the cloud
 *    is empty, push the local manual events up (first-sign-in migration).
 *  - Otherwise the cloud is the source of truth: replace local manual events
 *    with the cloud copy (preserving any non-manual events that may be cached).
 * Dispatches LOCAL_EVENTS_CHANGED so open views refresh.
 */
export async function hydrateEventsFromCloud(userId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const owner = getCacheOwner();
  const cached = loadLocalEvents();
  const cachedManual = cached.filter((e) => e.source === "manual");
  const cachedOther = cached.filter((e) => e.source !== "manual");

  let cloud: AgendaEvent[] = [];
  try {
    cloud = await loadLocalEventsCloud(userId);
  } catch (err) {
    console.warn("[alfred] could not load cloud events:", err);
    return;
  }

  if (cloud.length === 0) {
    const belongs = owner === null || owner === userId;
    if (belongs && cachedManual.length > 0) {
      try {
        await bulkUpsertLocalEvents(userId, cachedManual);
      } catch (err) {
        console.warn("[alfred] first-sign-in event migration failed:", err);
      }
      setCacheOwner(userId);
      return; // local already reflects these events
    }
    // Different owner with empty cloud → clear stale manual events.
    if (!belongs) {
      saveLocalEvents(cachedOther);
    }
    setCacheOwner(userId);
    return;
  }

  // Cloud has data → it wins for manual events; keep cached non-manual as-is.
  const merged = [...cachedOther, ...cloud];
  saveLocalEvents(merged);
  setCacheOwner(userId);
}
