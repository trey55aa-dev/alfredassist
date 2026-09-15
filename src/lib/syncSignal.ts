// One answer to "something may have changed on another device — re-pull."
//
// Alfred used to reconcile with the cloud exactly once, at login. Everything
// after that was push-only: a habit ticked on the phone reached the server
// within seconds, and the laptop — still open, still showing "synced" — never
// heard about it. This is the missing half.
//
// Two independent triggers, deliberately overlapping:
//
//  • Realtime postgres_changes. Live, sub-second. Silently inert until the
//    tables are added to the supabase_realtime publication (see the
//    20260915000000_realtime_sync migration), so it is an upgrade, never a
//    dependency.
//  • Focus, visibility and online events. Always available, no server-side
//    setup, and catches everything Realtime structurally can't — a dropped
//    socket, a tab backgrounded for hours, a stretch spent offline.
//
// Consumers stay in charge of *how* to reconcile; this only says "now".

import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type Listener = () => void;

/** Rows that carry cross-device state. All are scoped by user_id. */
const WATCHED_TABLES = ["goals", "habits", "habit_logs", "user_state"] as const;

/** Bursts are common (a bulk upsert is many row events); one pull covers them. */
const COALESCE_MS = 300;

const listeners = new Set<Listener>();
let channel: RealtimeChannel | null = null;
let channelUserId: string | null = null;
let domBound = false;
let timer: number | null = null;

function emit(): void {
  if (timer !== null) return; // already scheduled
  timer = window.setTimeout(() => {
    timer = null;
    for (const l of [...listeners]) {
      try {
        l();
      } catch {
        /* one bad listener must not stop the rest */
      }
    }
  }, COALESCE_MS);
}

function onVisible(): void {
  if (document.visibilityState === "visible") emit();
}

function bindDom(): void {
  if (domBound || typeof window === "undefined") return;
  domBound = true;
  window.addEventListener("focus", emit);
  window.addEventListener("online", emit);
  document.addEventListener("visibilitychange", onVisible);
}

function unbindDom(): void {
  if (!domBound || typeof window === "undefined") return;
  domBound = false;
  window.removeEventListener("focus", emit);
  window.removeEventListener("online", emit);
  document.removeEventListener("visibilitychange", onVisible);
}

/**
 * Point the realtime channel at a user. Idempotent — calling it repeatedly
 * with the same id is a no-op, and switching users tears the old one down.
 * Passing null (signed out) just unsubscribes.
 */
export function bindRemoteChanges(userId: string | null): void {
  if (userId === channelUserId) return;

  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  channelUserId = userId;
  if (!userId) return;

  const next = supabase.channel(`alfred-sync:${userId}`);
  for (const table of WATCHED_TABLES) {
    next.on(
      "postgres_changes",
      { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
      emit,
    );
  }
  // A failed subscribe is survivable: the focus/online triggers still fire, so
  // the app degrades to "syncs when you look at it" rather than breaking.
  next.subscribe();
  channel = next;
}

/** Listen for "re-pull now". Returns an unsubscribe. */
export function onRemoteChange(cb: Listener): () => void {
  listeners.add(cb);
  bindDom();
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) unbindDom();
  };
}

/** Test seam — fire the signal by hand. */
export function notifyRemoteChange(): void {
  emit();
}
