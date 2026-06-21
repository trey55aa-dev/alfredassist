// Browser-first notifications layer. Today: uses the Web Notifications API.
// Tomorrow (when iOS via Capacitor): swap the deliver() implementation to
// `@capacitor/local-notifications` — the rest of the app calls scheduleEventReminder
// / notifyCarryOver and stays untouched.

import type { AgendaEvent } from "./agenda";

const ENABLED_KEY = "alfred.notifications.enabled";
const SHOWN_KEY = "alfred.notifications.shownIds";

export type PermissionState = "granted" | "denied" | "default" | "unsupported";

export function isSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getPermission(): PermissionState {
  if (!isSupported()) return "unsupported";
  return Notification.permission as PermissionState;
}

export function isEnabled(): boolean {
  if (!isSupported()) return false;
  if (Notification.permission !== "granted") return false;
  return localStorage.getItem(ENABLED_KEY) !== "0";
}

export function setEnabled(on: boolean) {
  localStorage.setItem(ENABLED_KEY, on ? "1" : "0");
}

/* ---------- Reminder preferences ---------- */

const REMINDER_PREFS_KEY = "alfred.reminders.prefs";
export const REMINDER_PREFS_CHANGED = "alfred.reminders:changed";

export interface ReminderPrefs {
  /** "Starting soon" alerts for routine blocks / agenda events. */
  blockReminders: boolean;
  /** Evening nudge when today's protocol isn't complete. */
  streakNudge: boolean;
  /** Afternoon nudge to log progress on measurable goals. */
  goalNudge: boolean;
  /** Lead time (minutes) before an event to fire its reminder. */
  leadMinutes: number;
}

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  blockReminders: true,
  streakNudge: true,
  goalNudge: true,
  leadMinutes: 5,
};

export function getReminderPrefs(): ReminderPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_REMINDER_PREFS };
  try {
    const raw = localStorage.getItem(REMINDER_PREFS_KEY);
    return raw
      ? { ...DEFAULT_REMINDER_PREFS, ...(JSON.parse(raw) as Partial<ReminderPrefs>) }
      : { ...DEFAULT_REMINDER_PREFS };
  } catch {
    return { ...DEFAULT_REMINDER_PREFS };
  }
}

export function saveReminderPrefs(p: ReminderPrefs): void {
  try {
    localStorage.setItem(REMINDER_PREFS_KEY, JSON.stringify(p));
    window.dispatchEvent(new CustomEvent(REMINDER_PREFS_CHANGED));
  } catch {
    /* ignore */
  }
}

export async function requestPermission(): Promise<PermissionState> {
  if (!isSupported()) return "unsupported";
  if (Notification.permission === "granted") {
    setEnabled(true);
    return "granted";
  }
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  if (result === "granted") setEnabled(true);
  return result as PermissionState;
}

interface ShownMap {
  [key: string]: number; // expiry timestamp
}

function loadShown(): ShownMap {
  try {
    const raw = localStorage.getItem(SHOWN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ShownMap;
    // Garbage-collect anything older than 24h to keep this small
    const now = Date.now();
    const fresh: ShownMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v > now - 24 * 3600_000) fresh[k] = v;
    }
    return fresh;
  } catch {
    return {};
  }
}

function saveShown(map: ShownMap) {
  try {
    localStorage.setItem(SHOWN_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function markShown(key: string) {
  const map = loadShown();
  map[key] = Date.now() + 24 * 3600_000;
  saveShown(map);
}

function alreadyShown(key: string): boolean {
  return key in loadShown();
}

/** Low-level deliver — swap this for Capacitor's plugin in the iOS build. */
function deliver(title: string, options?: NotificationOptions): void {
  if (!isEnabled()) return;
  try {
    new Notification(title, {
      icon: "/favicon.ico",
      ...options,
    });
  } catch (err) {
    console.warn("[alfred] notification deliver failed", err);
  }
}

/** Show the "X items carried over" banner once per day. */
export function notifyCarryOver(count: number, day = new Date()): void {
  if (count <= 0) return;
  const key = `carry:${day.toISOString().slice(0, 10)}`;
  if (alreadyShown(key)) return;
  deliver("Carry-over from yesterday", {
    body: `${count} item${count === 1 ? "" : "s"} pulled forward — tap to review.`,
    tag: key,
  });
  markShown(key);
}

/** Fire a once-per-day nudge (deduped by key + date). Returns true if delivered. */
export function notifyDailyNudge(key: string, title: string, body: string): boolean {
  if (!isEnabled()) return false;
  const dayKey = `${key}:${new Date().toISOString().slice(0, 10)}`;
  if (alreadyShown(dayKey)) return false;
  deliver(title, { body, tag: dayKey });
  markShown(dayKey);
  return true;
}

/** Schedule a "starting soon" notification for a single timed event. */
export function scheduleEventReminder(
  event: AgendaEvent,
  leadMinutes = 5,
  now = new Date(),
): void {
  if (event.allDay || event.completed) return;
  const start = new Date(event.start).getTime();
  const fireAt = start - leadMinutes * 60_000;
  const delay = fireAt - now.getTime();
  if (delay < 0 || delay > 6 * 3600_000) return; // skip past + far-future
  const key = `event:${event.id}:${start}`;
  if (alreadyShown(key)) return;
  setTimeout(() => {
    if (alreadyShown(key)) return;
    deliver(event.title, {
      body: `Starting in ${leadMinutes} min${event.location ? ` · ${event.location}` : ""}`,
      tag: key,
    });
    markShown(key);
  }, delay);
}

/** Schedule reminders for everything happening in the next ~6 hours. */
export function scheduleUpcomingReminders(events: AgendaEvent[], now = new Date()): void {
  if (!isEnabled()) return;
  const prefs = getReminderPrefs();
  if (!prefs.blockReminders) return;
  for (const e of events) scheduleEventReminder(e, prefs.leadMinutes, now);
}
