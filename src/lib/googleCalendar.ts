// Browser-only Google Calendar via Google Identity Services (GIS).
// No backend, no refresh tokens — the access token lives in memory + localStorage
// and is silently renewed when the user is still signed into Google.

import type { AgendaEvent } from "./agenda";

const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const TOKEN_KEY = "alfred.google.token";
const CONNECTED_FLAG = "alfred.google.connected";

export const GOOGLE_CONNECTED_CHANGED = "alfred.google:changed";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: "Bearer";
  error?: string;
}

interface StoredToken {
  accessToken: string;
  /** Absolute epoch ms when the token expires. */
  expiresAt: number;
}

interface GoogleTokenClient {
  requestAccessToken: (overrides?: { prompt?: "" | "consent" }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: TokenResponse) => void;
            error_callback?: (err: { type: string; message?: string }) => void;
          }) => GoogleTokenClient;
          revoke: (token: string, cb?: () => void) => void;
        };
      };
    };
  }
}

let tokenClient: GoogleTokenClient | null = null;
let pendingResolve: ((token: string) => void) | null = null;
let pendingReject: ((err: Error) => void) | null = null;

export function isGoogleConfigured(): boolean {
  return !!CLIENT_ID;
}

export function isGoogleConnected(): boolean {
  if (typeof window === "undefined") return false;
  if (localStorage.getItem(CONNECTED_FLAG) !== "1") return false;
  const stored = readStoredToken();
  return !!stored && stored.expiresAt > Date.now();
}

function readStoredToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredToken;
  } catch {
    return null;
  }
}

function writeStoredToken(t: StoredToken | null) {
  if (t) {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function notifyChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(GOOGLE_CONNECTED_CHANGED));
  }
}

async function waitForGoogle(timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (typeof window !== "undefined" && !window.google?.accounts?.oauth2) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("Google Identity Services failed to load.");
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

function ensureTokenClient(): GoogleTokenClient {
  if (!CLIENT_ID) {
    throw new Error("VITE_GOOGLE_CLIENT_ID is not configured.");
  }
  if (tokenClient) return tokenClient;
  if (!window.google?.accounts.oauth2) {
    throw new Error("Google Identity Services not loaded yet.");
  }
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: (resp) => {
      if (resp.error || !resp.access_token) {
        pendingReject?.(new Error(resp.error ?? "No access token returned."));
      } else {
        const stored: StoredToken = {
          accessToken: resp.access_token,
          // expires_in is seconds; subtract 60s safety margin
          expiresAt: Date.now() + (resp.expires_in - 60) * 1000,
        };
        writeStoredToken(stored);
        localStorage.setItem(CONNECTED_FLAG, "1");
        notifyChange();
        pendingResolve?.(resp.access_token);
      }
      pendingResolve = null;
      pendingReject = null;
    },
    error_callback: (err) => {
      pendingReject?.(new Error(err.message ?? err.type));
      pendingResolve = null;
      pendingReject = null;
    },
  });
  return tokenClient;
}

/** Pop the consent screen and store an access token. */
export async function connectGoogleCalendar(): Promise<void> {
  await waitForGoogle();
  const client = ensureTokenClient();
  return new Promise<void>((resolve, reject) => {
    pendingResolve = () => resolve();
    pendingReject = reject;
    client.requestAccessToken({ prompt: "consent" });
  });
}

/** Silent renewal — only works if the user is still signed into Google in this browser. */
async function silentRenew(): Promise<string> {
  await waitForGoogle();
  const client = ensureTokenClient();
  return new Promise<string>((resolve, reject) => {
    pendingResolve = (tok) => resolve(tok);
    pendingReject = reject;
    client.requestAccessToken({ prompt: "" });
  });
}

/** Get a valid access token, renewing silently if needed. Throws if disconnected. */
export async function getAccessToken(): Promise<string> {
  const stored = readStoredToken();
  if (stored && stored.expiresAt > Date.now()) return stored.accessToken;
  if (localStorage.getItem(CONNECTED_FLAG) !== "1") {
    throw new Error("Google Calendar is not connected.");
  }
  return silentRenew();
}

export async function disconnectGoogleCalendar(): Promise<void> {
  const stored = readStoredToken();
  writeStoredToken(null);
  localStorage.removeItem(CONNECTED_FLAG);
  if (stored?.accessToken && window.google?.accounts.oauth2) {
    await new Promise<void>((resolve) =>
      window.google!.accounts.oauth2.revoke(stored.accessToken, () => resolve()),
    );
  }
  notifyChange();
}

/* ---------- Calendar API ---------- */

interface GoogleEventResource {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  colorId?: string;
  status?: string;
  extendedProperties?: { private?: Record<string, string> };
}

function fromGoogleEvent(g: GoogleEventResource): AgendaEvent | null {
  if (g.status === "cancelled") return null;
  const allDay = !!g.start.date && !g.start.dateTime;
  const start = g.start.dateTime ?? `${g.start.date}T00:00:00`;
  const end = g.end.dateTime ?? `${g.end.date}T23:59:59`;
  const ext = g.extendedProperties?.private ?? {};
  return {
    id: `gcal:${g.id}`,
    title: g.summary ?? "(no title)",
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    allDay,
    location: g.location,
    description: g.description,
    source: "google",
    calendarName: "Google Calendar",
    calendarColor: GOOGLE_COLOR_MAP[g.colorId ?? ""] ?? "hsl(200 70% 60%)",
    emoji: ext.alfredEmoji || undefined,
    completed: ext.alfredCompleted === "1",
  };
}

/** Approximate mapping of Google calendar colorIds → tasteful HSL.
 *  Google's palette is tiny; this just keeps colors visually distinct on the timeline. */
const GOOGLE_COLOR_MAP: Record<string, string> = {
  "1": "hsl(220 80% 65%)", // Lavender
  "2": "hsl(150 50% 50%)", // Sage
  "3": "hsl(270 55% 60%)", // Grape
  "4": "hsl(0 70% 60%)", // Flamingo
  "5": "hsl(45 90% 55%)", // Banana
  "6": "hsl(20 85% 60%)", // Tangerine
  "7": "hsl(200 70% 55%)", // Peacock
  "8": "hsl(220 10% 55%)", // Graphite
  "9": "hsl(220 70% 50%)", // Blueberry
  "10": "hsl(140 50% 45%)", // Basil
  "11": "hsl(0 70% 50%)", // Tomato
};

function isoToGoogleDate(iso: string): string {
  return iso.slice(0, 10);
}

function toGoogleEventBody(
  event: Omit<AgendaEvent, "id" | "source">,
): Partial<GoogleEventResource> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const body: Partial<GoogleEventResource> = {
    summary: event.title,
    description: event.description,
    location: event.location,
  };
  if (event.allDay) {
    body.start = { date: isoToGoogleDate(event.start) };
    body.end = { date: isoToGoogleDate(event.end) };
  } else {
    body.start = { dateTime: event.start, timeZone: tz };
    body.end = { dateTime: event.end, timeZone: tz };
  }
  body.extendedProperties = {
    private: {
      ...(event.emoji ? { alfredEmoji: event.emoji } : {}),
      ...(event.completed ? { alfredCompleted: "1" } : {}),
    },
  };
  return body;
}

async function gcalFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  const resp = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Google Calendar ${resp.status}: ${text}`);
  }
  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}

export async function listGoogleEventsForDay(day = new Date()): Promise<AgendaEvent[]> {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);
  const params = new URLSearchParams({
    timeMin: dayStart.toISOString(),
    timeMax: dayEnd.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });
  const data = await gcalFetch<{ items?: GoogleEventResource[] }>(
    `/calendars/primary/events?${params.toString()}`,
  );
  return (data.items ?? [])
    .map(fromGoogleEvent)
    .filter((e): e is AgendaEvent => e !== null);
}

export async function createGoogleEvent(
  event: Omit<AgendaEvent, "id" | "source">,
): Promise<AgendaEvent> {
  const body = toGoogleEventBody(event);
  const created = await gcalFetch<GoogleEventResource>(
    "/calendars/primary/events",
    { method: "POST", body: JSON.stringify(body) },
  );
  const mapped = fromGoogleEvent(created);
  if (!mapped) throw new Error("Failed to map created Google event.");
  return mapped;
}

export async function updateGoogleEvent(
  alfredId: string,
  patch: Partial<Omit<AgendaEvent, "id" | "source">>,
): Promise<AgendaEvent> {
  const googleId = alfredId.replace(/^gcal:/, "");
  // Read-modify-write so we don't blow away fields we don't manage.
  const existing = await gcalFetch<GoogleEventResource>(
    `/calendars/primary/events/${encodeURIComponent(googleId)}`,
  );
  const merged: Omit<AgendaEvent, "id" | "source"> = {
    title: patch.title ?? existing.summary ?? "",
    start: patch.start ?? existing.start.dateTime ?? `${existing.start.date}T00:00:00`,
    end: patch.end ?? existing.end.dateTime ?? `${existing.end.date}T23:59:59`,
    allDay: patch.allDay ?? !!existing.start.date,
    location: patch.location ?? existing.location,
    description: patch.description ?? existing.description,
    emoji: patch.emoji ?? existing.extendedProperties?.private?.alfredEmoji,
    completed:
      patch.completed ??
      existing.extendedProperties?.private?.alfredCompleted === "1",
    calendarColor: patch.calendarColor,
    calendarName: patch.calendarName,
  };
  const body = toGoogleEventBody(merged);
  const updated = await gcalFetch<GoogleEventResource>(
    `/calendars/primary/events/${encodeURIComponent(googleId)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
  const mapped = fromGoogleEvent(updated);
  if (!mapped) throw new Error("Failed to map updated Google event.");
  return mapped;
}

export async function deleteGoogleEvent(alfredId: string): Promise<void> {
  const googleId = alfredId.replace(/^gcal:/, "");
  await gcalFetch<void>(
    `/calendars/primary/events/${encodeURIComponent(googleId)}`,
    { method: "DELETE" },
  );
}

export function isGoogleEvent(id: string): boolean {
  return id.startsWith("gcal:");
}
