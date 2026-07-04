// Tiny global sync-status bus. The scattered cloud hooks (goals, habits) report
// their save activity/errors here so a single header indicator can reflect them —
// so a failed save is visible, never silent (the bug class that bit us before).

import { useEffect, useState, useSyncExternalStore } from "react";

export interface SyncState {
  syncing: boolean;
  error: string | null;
  lastSyncedAt: number | null;
}

let state: SyncState = { syncing: false, error: null, lastSyncedAt: null };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Report a change from a cloud hook. Pass what changed; the rest is preserved. */
export function reportSync(patch: Partial<SyncState>): void {
  const next: SyncState = { ...state, ...patch };
  if (patch.syncing === false && (patch.error === null || patch.error === undefined)) {
    next.lastSyncedAt = Date.now();
    next.error = patch.error ?? null;
  }
  state = next;
  emit();
}

export function getSyncState(): SyncState {
  return state;
}

export function subscribeSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Sync state + live online/offline. */
export function useSyncStatus(): SyncState & { online: boolean } {
  const sync = useSyncExternalStore(subscribeSync, getSyncState, getSyncState);
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return { ...sync, online };
}
