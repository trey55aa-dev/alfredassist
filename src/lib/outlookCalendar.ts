// Browser-only Outlook/Microsoft 365 calendar via MSAL.js + Microsoft Graph.
// Mirrors googleCalendar.ts: connect/disconnect, list/create/update/delete on
// the user's default calendar. MSAL handles token cache + silent renewal.
//
// Alfred-only fields (emoji, completed) are NOT round-tripped to Graph in v1 —
// they live in a small localStorage overlay keyed by the Outlook event id.

import {
  PublicClientApplication,
  type AccountInfo,
  type RedirectRequest,
} from "@azure/msal-browser";
import type { AgendaEvent } from "./agenda";

const CLIENT_ID = import.meta.env.VITE_MS_CLIENT_ID as string | undefined;
const SCOPES = ["User.Read", "Calendars.ReadWrite"];
const CONNECTED_FLAG = "alfred.outlook.connected";
const OVERLAY_KEY = "alfred.outlook.overlay"; // { [eventId]: { emoji?, completed?, color? } }

export const OUTLOOK_CONNECTED_CHANGED = "alfred.outlook:changed";

let msal: PublicClientApplication | null = null;
let initPromise: Promise<void> | null = null;

export function isOutlookConfigured(): boolean {
  return !!CLIENT_ID;
}

async function getMsal(): Promise<PublicClientApplication> {
  if (!CLIENT_ID) throw new Error("VITE_MS_CLIENT_ID is not configured.");
  if (msal) {
    await initPromise;
    return msal;
  }
  msal = new PublicClientApplication({
    auth: {
      clientId: CLIENT_ID,
      authority: "https://login.microsoftonline.com/common",
      redirectUri: window.location.origin,
    },
    cache: {
      cacheLocation: "localStorage",
    },
  });
  initPromise = msal.initialize();
  await initPromise;
  return msal;
}

function activeAccount(app: PublicClientApplication): AccountInfo | null {
  const current = app.getActiveAccount();
  if (current) return current;
  const all = app.getAllAccounts();
  if (all.length > 0) {
    app.setActiveAccount(all[0]);
    return all[0];
  }
  return null;
}

export function isOutlookConnected(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CONNECTED_FLAG) === "1";
}

function notifyChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OUTLOOK_CONNECTED_CHANGED));
  }
}

export async function connectOutlookCalendar(): Promise<void> {
  const app = await getMsal();
  const req: RedirectRequest = { scopes: SCOPES, prompt: "select_account" };
  const result = await app.loginPopup(req);
  app.setActiveAccount(result.account);
  localStorage.setItem(CONNECTED_FLAG, "1");
  notifyChange();
}

export async function disconnectOutlookCalendar(): Promise<void> {
  localStorage.removeItem(CONNECTED_FLAG);
  try {
    const app = await getMsal();
    const acct = activeAccount(app);
    if (acct) {
      // Clear MSAL cache for this account without a full redirect logout.
      await app.clearCache({ account: acct });
    }
  } catch {
    /* ignore */
  }
  notifyChange();
}

export async function getAccessToken(): Promise<string> {
  const app = await getMsal();
  const account = activeAccount(app);
  if (!account) throw new Error("Outlook is not connected.");
  try {
    const res = await app.acquireTokenSilent({ scopes: SCOPES, account });
    return res.accessToken;
  } catch {
    // Silent failed (expired / consent) — fall back to interactive popup.
    const res = await app.acquireTokenPopup({ scopes: SCOPES, account });
    return res.accessToken;
  }
}

/* ---------- Alfred-side overlay (emoji / completed / color) ---------- */

interface Overlay {
  [eventId: string]: { emoji?: string; completed?: boolean; color?: string };
}

function loadOverlay(): Overlay {
  try {
    return JSON.parse(localStorage.getItem(OVERLAY_KEY) ?? "{}") as Overlay;
  } catch {
    return {};
  }
}

function patchOverlay(
  eventId: string,
  patch: Partial<Overlay[string]>,
): void {
  const o = loadOverlay();
  o[eventId] = { ...o[eventId], ...patch };
  localStorage.setItem(OVERLAY_KEY, JSON.stringify(o));
}

/* ---------- Graph API ---------- */

interface GraphEvent {
  id: string;
  subject?: string;
  bodyPreview?: string;
  body?: { content?: string; contentType?: string };
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay?: boolean;
  location?: { displayName?: string };
  isCancelled?: boolean;
}

function alfredId(graphId: string): string {
  return `msft:${graphId}`;
}

export function isOutlookEvent(id: string): boolean {
  return id.startsWith("msft:");
}

function stripPrefix(id: string): string {
  return id.replace(/^msft:/, "");
}

function fromGraphEvent(g: GraphEvent): AgendaEvent | null {
  if (g.isCancelled) return null;
  const id = alfredId(g.id);
  const overlay = loadOverlay()[id] ?? {};
  // Graph returns local-naive dateTime + a timeZone; treat as UTC when timeZone is UTC.
  const start = new Date(
    g.start.timeZone === "UTC" ? `${g.start.dateTime}Z` : g.start.dateTime,
  );
  const end = new Date(
    g.end.timeZone === "UTC" ? `${g.end.dateTime}Z` : g.end.dateTime,
  );
  return {
    id,
    title: g.subject ?? "(no title)",
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: !!g.isAllDay,
    location: g.location?.displayName || undefined,
    description: g.body?.content || g.bodyPreview || undefined,
    source: "outlook",
    calendarName: "Outlook",
    calendarColor: overlay.color ?? "hsl(210 90% 60%)",
    emoji: overlay.emoji,
    completed: overlay.completed ?? false,
  };
}

function toGraphBody(
  event: Omit<AgendaEvent, "id" | "source">,
): Record<string, unknown> {
  const tz = "UTC";
  const body: Record<string, unknown> = {
    subject: event.title,
    body: { contentType: "text", content: event.description ?? "" },
    isAllDay: !!event.allDay,
    start: {
      dateTime: new Date(event.start).toISOString().slice(0, 19),
      timeZone: tz,
    },
    end: {
      dateTime: new Date(event.end).toISOString().slice(0, 19),
      timeZone: tz,
    },
  };
  if (event.location) {
    body.location = { displayName: event.location };
  }
  return body;
}

async function graphFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  const resp = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Microsoft Graph ${resp.status}: ${text}`);
  }
  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}

export async function listOutlookEventsForDay(
  day = new Date(),
): Promise<AgendaEvent[]> {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);
  const params = new URLSearchParams({
    startDateTime: dayStart.toISOString(),
    endDateTime: dayEnd.toISOString(),
    $orderby: "start/dateTime",
    $top: "100",
  });
  const data = await graphFetch<{ value?: GraphEvent[] }>(
    `/me/calendarView?${params.toString()}`,
  );
  return (data.value ?? [])
    .map(fromGraphEvent)
    .filter((e): e is AgendaEvent => e !== null);
}

export async function createOutlookEvent(
  event: Omit<AgendaEvent, "id" | "source">,
): Promise<AgendaEvent> {
  const created = await graphFetch<GraphEvent>("/me/events", {
    method: "POST",
    body: JSON.stringify(toGraphBody(event)),
  });
  const mapped = fromGraphEvent(created);
  if (!mapped) throw new Error("Failed to map created Outlook event.");
  if (event.emoji || event.calendarColor) {
    patchOverlay(mapped.id, {
      emoji: event.emoji,
      color: event.calendarColor,
    });
  }
  return { ...mapped, emoji: event.emoji, calendarColor: event.calendarColor };
}

export async function updateOutlookEvent(
  id: string,
  patch: Partial<Omit<AgendaEvent, "id" | "source">>,
): Promise<AgendaEvent> {
  const graphId = stripPrefix(id);
  // Alfred-only fields stay in the overlay; don't PATCH them to Graph.
  if (patch.emoji !== undefined || patch.completed !== undefined || patch.calendarColor !== undefined) {
    patchOverlay(id, {
      ...(patch.emoji !== undefined ? { emoji: patch.emoji } : {}),
      ...(patch.completed !== undefined ? { completed: patch.completed } : {}),
      ...(patch.calendarColor !== undefined ? { color: patch.calendarColor } : {}),
    });
  }
  const graphPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) graphPatch.subject = patch.title;
  if (patch.description !== undefined)
    graphPatch.body = { contentType: "text", content: patch.description };
  if (patch.location !== undefined)
    graphPatch.location = { displayName: patch.location };
  if (patch.allDay !== undefined) graphPatch.isAllDay = patch.allDay;
  if (patch.start !== undefined)
    graphPatch.start = {
      dateTime: new Date(patch.start).toISOString().slice(0, 19),
      timeZone: "UTC",
    };
  if (patch.end !== undefined)
    graphPatch.end = {
      dateTime: new Date(patch.end).toISOString().slice(0, 19),
      timeZone: "UTC",
    };

  let updated: GraphEvent;
  if (Object.keys(graphPatch).length > 0) {
    updated = await graphFetch<GraphEvent>(
      `/me/events/${encodeURIComponent(graphId)}`,
      { method: "PATCH", body: JSON.stringify(graphPatch) },
    );
  } else {
    updated = await graphFetch<GraphEvent>(
      `/me/events/${encodeURIComponent(graphId)}`,
    );
  }
  const mapped = fromGraphEvent(updated);
  if (!mapped) throw new Error("Failed to map updated Outlook event.");
  return mapped;
}

export async function deleteOutlookEvent(id: string): Promise<void> {
  const graphId = stripPrefix(id);
  await graphFetch<void>(`/me/events/${encodeURIComponent(graphId)}`, {
    method: "DELETE",
  });
  const o = loadOverlay();
  delete o[id];
  localStorage.setItem(OVERLAY_KEY, JSON.stringify(o));
}
