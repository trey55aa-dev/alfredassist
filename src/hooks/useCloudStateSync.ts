// Generic cloud sync for app state that was previously local-only.
//
// Strategy (mounted once in AppLayout):
//  1. On login, pull all rows from public.user_state and reconcile each key:
//       • no local      → adopt cloud
//       • both arrays   → UNION-merge (append-collections: nothing is lost on
//                         either device — journal entries, timer history, …)
//       • first run     → keep local (local-first), push it up
//       • otherwise     → last-write-wins by timestamp
//  2. After that, poll localStorage every few seconds; when an allowlisted key
//     changes, stamp it and push it up (also flushes on tab hide / pagehide).
//
// Degrades gracefully: if the user_state table doesn't exist yet (migration not
// applied), pulls return [] and pushes are swallowed — the app stays local-only.

import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { pullUserState, upsertUserState } from "@/lib/userStateRepo";
import type { Json } from "@/integrations/supabase/types";

// Only keys with NO existing dedicated sync. (goals/habits/customLists/recurring/
// agenda each have their own; google/outlook tokens & device-only prefs are excluded.)
const SYNCED_KEYS = [
  "alfred.gamification",
  "alfred.streak",
  "alfred.journal",
  "alfred.brain",
  "alfred.focus.stats",
  "alfred.timer.history",
  "alfred.weeklyPlan.v1",
  // Previously device-only — now synced so phone & computer match.
  "alfred.mood.log",        // array of mood entries (id-keyed union merge)
  "alfred.habitNotes",      // { habitId: comment }
  "alfred.habitLogTimes",   // { habitId|date: ms } — powers hour-of-day stats
  "alfred.goalDaily.done",  // { goalId|date: true } — daily goal check-ins
  "alfred.decisions",       // accept/dismiss log — Alfred's learning follows you
  "alfred.scene",           // chosen background scene — your look follows you
];

// Extra change events to fire after adopting a cloud value, so a screen that's
// already open refreshes (beyond the generic useLocalStorage listener).
const REFRESH_EVENTS: Record<string, string> = {
  "alfred.weeklyPlan.v1": "alfred.weeklyPlan:changed",
  "alfred.timer.history": "alfred.timer:changed",
  "alfred.mood.log": "alfred.mood:changed",
  "alfred.scene": "alfred.scene:changed", // SceneBackground repaints live
};

const POLL_MS = 4000;
const tsKey = (k: string) => `${k}::syncedAt`;

function readRaw(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function readTs(key: string): number {
  try { return Number(localStorage.getItem(tsKey(key)) || "0") || 0; } catch { return 0; }
}
function setTs(key: string, ts: number): void {
  try { localStorage.setItem(tsKey(key), String(ts)); } catch { /* quota */ }
}
function writeLocal(key: string, raw: string, ts: number): void {
  try {
    localStorage.setItem(key, raw);
    localStorage.setItem(tsKey(key), String(ts));
  } catch { /* quota */ }
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(`alfred.ls:${key}`));
  const extra = REFRESH_EVENTS[key];
  if (extra) window.dispatchEvent(new CustomEvent(extra));
}
function parse(raw: string | null): unknown {
  if (raw == null) return undefined;
  try { return JSON.parse(raw); } catch { return undefined; }
}

/** Union two arrays: by `id` when both sides have it (b wins on conflict when
 *  bWins), else dedupe by JSON identity (immutable logs). Exported for testing. */
export function mergeArrays(a: unknown[], b: unknown[], bWins: boolean): unknown[] {
  const hasIds =
    a.every((x) => x && typeof x === "object" && "id" in (x as object)) &&
    b.every((x) => x && typeof x === "object" && "id" in (x as object));
  if (hasIds) {
    const map = new Map<string, unknown>();
    const first = bWins ? a : b;
    const second = bWins ? b : a;
    for (const e of first) map.set(String((e as Record<string, unknown>).id), e);
    for (const e of second) map.set(String((e as Record<string, unknown>).id), e);
    return [...map.values()];
  }
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const e of [...a, ...b]) {
    const k = JSON.stringify(e);
    if (!seen.has(k)) { seen.add(k); out.push(e); }
  }
  return out;
}

export function useCloudStateSync(): void {
  const { user } = useAuth();
  const lastSeen = useRef<Map<string, string | null>>(new Map());
  const readyRef = useRef(false);

  // ── Reconcile on login ──
  useEffect(() => {
    if (!user) return;
    let alive = true;
    readyRef.current = false;
    const userId = user.id;

    (async () => {
      const cloudRows = await pullUserState(userId);
      if (!alive) return;
      const cloudByKey = new Map(cloudRows.map((r) => [r.key, r]));

      for (const key of SYNCED_KEYS) {
        const localRaw = readRaw(key);
        const localTs = readTs(key);
        const cloud = cloudByKey.get(key);

        if (cloud && cloud.value !== null) {
          const cloudRaw = JSON.stringify(cloud.value);
          const localVal = parse(localRaw);
          const cloudVal = cloud.value as unknown;

          if (localRaw == null) {
            writeLocal(key, cloudRaw, cloud.updatedAt);
          } else if (Array.isArray(localVal) && Array.isArray(cloudVal)) {
            const merged = mergeArrays(localVal, cloudVal, cloud.updatedAt >= localTs);
            const mergedRaw = JSON.stringify(merged);
            const now = Date.now();
            writeLocal(key, mergedRaw, now);
            if (mergedRaw !== cloudRaw) {
              upsertUserState(userId, key, merged as Json, now).catch(() => {});
            }
          } else if (localTs === 0) {
            setTs(key, Date.now());
            upsertUserState(userId, key, localVal as Json, readTs(key)).catch(() => {});
          } else if (cloud.updatedAt > localTs) {
            writeLocal(key, cloudRaw, cloud.updatedAt);
          } else if (localTs > cloud.updatedAt) {
            upsertUserState(userId, key, localVal as Json, localTs).catch(() => {});
          }
        } else if (localRaw != null) {
          const ts = localTs || Date.now();
          setTs(key, ts);
          upsertUserState(userId, key, parse(localRaw) as Json, ts).catch(() => {});
        }

        lastSeen.current.set(key, readRaw(key));
      }
      readyRef.current = true;
    })();

    return () => { alive = false; };
  }, [user]);

  // ── Push local changes ──
  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    const flush = () => {
      if (!readyRef.current) return;
      for (const key of SYNCED_KEYS) {
        const raw = readRaw(key);
        if (raw === (lastSeen.current.get(key) ?? null)) continue;
        lastSeen.current.set(key, raw);
        if (raw == null) continue; // not handling deletes from here
        const val = parse(raw);
        if (val === undefined) continue;
        const ts = Date.now();
        setTs(key, ts);
        upsertUserState(userId, key, val as Json, ts).catch(() => {});
      }
    };
    const id = window.setInterval(flush, POLL_MS);
    const onVis = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flush);
    };
  }, [user]);
}
