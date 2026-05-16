// Carry-over for incomplete events. Runs once per day on app load.
// Strategy:
//   - Find every non-completed, non-all-day event whose end is in the past (yesterday or older)
//   - Reschedule it to today, preserving the time-of-day window (e.g. 14:00–15:00 yesterday → 14:00–15:00 today)
//   - Stamp originalDate (first carry only) and bump carryCount
//   - Local events are mutated in localStorage; Google events are PATCH'd via the API
//
// Idempotency: tracked via "alfred.agenda.lastCarryDay" — only runs once per local calendar day.

import type { AgendaEvent } from "./agenda";
import { todayKey } from "./alfred";
import {
  loadLocalEvents,
  saveLocalEvents,
} from "./agendaStore";

export const LAST_CARRY_KEY = "alfred.agenda.lastCarryDay";

export interface CarryResult {
  carried: AgendaEvent[];
  skipped: number;
  failed: { event: AgendaEvent; error: string }[];
}

/** Shift a single ISO timestamp from its date to today's date, keeping the time-of-day. */
function shiftToToday(iso: string, today = new Date()): string {
  const d = new Date(iso);
  const next = new Date(today);
  next.setHours(d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  return next.toISOString();
}

function eventIsCarryable(e: AgendaEvent, now: Date): boolean {
  if (e.completed) return false;
  if (e.allDay) return false; // all-day events shouldn't shift
  const end = new Date(e.end).getTime();
  return end < now.getTime() && !sameLocalDay(end, now.getTime());
}

function sameLocalDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function carryEvent(e: AgendaEvent, today: Date): AgendaEvent {
  const originalDate = e.originalDate ?? new Date(e.start).toISOString().slice(0, 10);
  return {
    ...e,
    start: shiftToToday(e.start, today),
    end: shiftToToday(e.end, today),
    originalDate,
    carryCount: (e.carryCount ?? 0) + 1,
  };
}

/** Run the carry-over pass for today's local date. Idempotent. */
export async function runCarryOver(now = new Date()): Promise<CarryResult> {
  const today = todayKey(now);
  if (typeof window !== "undefined") {
    const last = localStorage.getItem(LAST_CARRY_KEY);
    if (last === today) {
      return { carried: [], skipped: 0, failed: [] };
    }
  }

  const result: CarryResult = { carried: [], skipped: 0, failed: [] };

  /* ---- Local events ---- */
  const local = loadLocalEvents();
  const updatedLocal: AgendaEvent[] = [];
  let localChanged = false;
  for (const e of local) {
    if (eventIsCarryable(e, now)) {
      const carried = carryEvent(e, now);
      updatedLocal.push(carried);
      result.carried.push(carried);
      localChanged = true;
    } else {
      updatedLocal.push(e);
      if (e.completed && new Date(e.end) < now && !sameLocalDay(new Date(e.end).getTime(), now.getTime())) {
        result.skipped++;
      }
    }
  }
  if (localChanged) saveLocalEvents(updatedLocal);

  /* ---- Google events ---- */
  // We only carry Google events that fall in the last 7 days, to avoid
  // a huge list query. Anything older the user can manually reschedule.
  try {
    const { isGoogleConnected, listGoogleEventsForDay, updateGoogleEvent } = await import(
      "./googleCalendar"
    );
    if (isGoogleConnected()) {
      for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
        const day = new Date(now);
        day.setDate(day.getDate() - dayOffset);
        let dayEvents: AgendaEvent[] = [];
        try {
          dayEvents = await listGoogleEventsForDay(day);
        } catch (err) {
          console.warn("[alfred] carry-over: failed to list Google events", err);
          break;
        }
        for (const e of dayEvents) {
          if (!eventIsCarryable(e, now)) continue;
          const carried = carryEvent(e, now);
          try {
            await updateGoogleEvent(e.id, {
              start: carried.start,
              end: carried.end,
              // We can't write `originalDate` / `carryCount` directly — use extendedProperties.
              // Stash via title-suffix? No — better: use extendedProperties on the Google event.
              // For now, store in description as a fallback. Cleaner: extend updateGoogleEvent
              // to accept extra extendedProperties. We'll keep it simple v1: Alfred-side state only.
            });
            result.carried.push(carried);
          } catch (err) {
            result.failed.push({
              event: e,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn("[alfred] carry-over: Google module load failed", err);
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(LAST_CARRY_KEY, today);
  }
  return result;
}

/** Severity tier for visual escalation, based on carryCount. */
export type CarrySeverity = "fresh" | "nudge" | "warn" | "alarm";

export function carrySeverity(e: AgendaEvent): CarrySeverity {
  const c = e.carryCount ?? 0;
  if (c === 0) return "fresh";
  if (c === 1) return "nudge";
  if (c === 2) return "warn";
  return "alarm";
}

export function carrySeverityLabel(s: CarrySeverity): string {
  switch (s) {
    case "fresh":
      return "";
    case "nudge":
      return "Carried once";
    case "warn":
      return "Carried twice";
    case "alarm":
      return "Repeatedly skipped";
  }
}
