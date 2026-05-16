// Auto follow-up generation from calendar events.
// For each timed event that ended in the past N days and matches a follow-up trigger,
// create a local Alfred event titled "Follow up: <title>" 24h or 48h after the original ended.
//
// Rules (v1):
//   - Job-interview-shaped events ("interview", "intro call", "phone screen",
//     "recruiter", "hiring manager", "panel", "tech screen") → 24h follow-up
//   - Anything else: only auto-follow if the user explicitly opts in (future).
//   - Idempotent: keyed by source-event-id so we never duplicate.

import type { AgendaEvent } from "./agenda";
import { addLocalEvent, loadLocalEvents } from "./agendaStore";

const SEEN_KEY = "alfred.followups.seenIds";
const SETTINGS_KEY = "alfred.followups.settings";

export interface FollowUpSettings {
  enabled: boolean;
  /** Hours after original event end. */
  defaultOffsetHours: number;
  /** Hours offset for interview-tagged events. */
  interviewOffsetHours: number;
}

export const DEFAULT_FOLLOWUP_SETTINGS: FollowUpSettings = {
  enabled: true,
  defaultOffsetHours: 48,
  interviewOffsetHours: 24,
};

const INTERVIEW_PATTERN =
  /\b(interview|intro\s*call|phone\s*screen|tech\s*screen|recruiter|hiring\s*manager|panel|onsite|on-site|chat\s+with)\b/i;

export function getFollowUpSettings(): FollowUpSettings {
  if (typeof window === "undefined") return DEFAULT_FOLLOWUP_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_FOLLOWUP_SETTINGS;
    return { ...DEFAULT_FOLLOWUP_SETTINGS, ...(JSON.parse(raw) as Partial<FollowUpSettings>) };
  } catch {
    return DEFAULT_FOLLOWUP_SETTINGS;
  }
}

export function saveFollowUpSettings(s: FollowUpSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

function loadSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function saveSeen(set: Set<string>) {
  if (typeof window === "undefined") return;
  // Cap at 1000 most recent to avoid unbounded growth
  const arr = Array.from(set).slice(-1000);
  localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
}

interface Candidate {
  source: AgendaEvent;
  isInterview: boolean;
  followUpStart: Date;
  followUpEnd: Date;
}

function classify(
  e: AgendaEvent,
  settings: FollowUpSettings,
): Candidate | null {
  if (e.allDay) return null;
  const text = `${e.title} ${e.description ?? ""}`;
  const isInterview = INTERVIEW_PATTERN.test(text);
  if (!isInterview) return null; // v1: only auto-create for interview-shaped events
  const offsetHours = settings.interviewOffsetHours;
  const start = new Date(new Date(e.end).getTime() + offsetHours * 3600_000);
  // Default to a 15-minute slot at 9am-ish: snap to the nearest hour after offset
  start.setMinutes(0, 0, 0);
  if (start.getHours() < 9) start.setHours(9);
  if (start.getHours() > 17) start.setHours(9);
  const end = new Date(start.getTime() + 15 * 60_000);
  return { source: e, isInterview, followUpStart: start, followUpEnd: end };
}

function buildFollowUpEvent(c: Candidate): AgendaEvent {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `fu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    title: c.isInterview
      ? `Follow up: ${c.source.title}`
      : `Follow up: ${c.source.title}`,
    start: c.followUpStart.toISOString(),
    end: c.followUpEnd.toISOString(),
    allDay: false,
    description: c.isInterview
      ? `Send thank-you / status check.\n\nOriginal: ${c.source.title}${
          c.source.location ? ` · ${c.source.location}` : ""
        }${
          c.source.description ? `\nNotes: ${c.source.description}` : ""
        }`
      : `Follow up on: ${c.source.title}`,
    source: "manual",
    calendarName: "Alfred · Follow-up",
    calendarColor: "hsl(45 80% 55%)",
    emoji: c.isInterview ? "💼" : "📞",
  };
}

export interface FollowUpResult {
  created: AgendaEvent[];
  skipped: number;
}

/** Scan a list of events and create follow-ups for unseen interview-shaped ones. */
export function processForFollowUps(events: AgendaEvent[]): FollowUpResult {
  const settings = getFollowUpSettings();
  const result: FollowUpResult = { created: [], skipped: 0 };
  if (!settings.enabled) return result;

  const seen = loadSeen();
  const localEvents = loadLocalEvents();
  // Also skip if a follow-up already exists by title — defensive against past created-but-unseen.
  const existingTitles = new Set(
    localEvents.map((e) => e.title.toLowerCase()),
  );

  for (const e of events) {
    const key = `${e.source}:${e.id}`;
    if (seen.has(key)) {
      result.skipped++;
      continue;
    }
    const candidate = classify(e, settings);
    if (!candidate) {
      seen.add(key); // remember we considered & rejected this event
      continue;
    }
    const followUp = buildFollowUpEvent(candidate);
    if (existingTitles.has(followUp.title.toLowerCase())) {
      seen.add(key);
      result.skipped++;
      continue;
    }
    addLocalEvent(followUp);
    seen.add(key);
    result.created.push(followUp);
  }

  saveSeen(seen);
  return result;
}
