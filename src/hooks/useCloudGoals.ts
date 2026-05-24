import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  bulkUpsertGoals,
  deleteGoalByClientId,
  loadGoals,
  upsertGoal,
} from "@/lib/goalsRepo";
import { GOALS_KEY, type Goal, SEED_GOALS } from "@/lib/goals";

/**
 * Cloud-backed goals hook with a localStorage cache.
 *
 * Behavior:
 *  - Mount: fetch from Supabase. Show cached localStorage immediately for snappy UX.
 *  - First sign-in (cloud empty + we have local goals): bulk-upload local → cloud.
 *  - Mutations: optimistic local update + cache, then a debounced diff/upsert/delete
 *    against the last-known cloud state. Last-write-wins; fine for single-user.
 *  - Offline / not signed in: returns the cached / seed data, syncing flag stays false.
 */
export function useCloudGoals(): {
  goals: Goal[];
  setGoals: (next: Goal[]) => void;
  loading: boolean;
  syncing: boolean;
  error: string | null;
  signedIn: boolean;
} {
  const { user, loading: authLoading } = useAuth();
  const [goals, setGoalsState] = useState<Goal[]>(() => readCache());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Last known cloud snapshot — used to compute the diff on each save.
  const cloudRef = useRef<Goal[]>([]);
  const debounceRef = useRef<number | null>(null);
  const pendingRef = useRef<Goal[] | null>(null);

  /* ---------- initial fetch + first-sign-in migration ---------- */

  useEffect(() => {
    let alive = true;
    if (authLoading) return;
    if (!user) {
      // Not signed in — fall back to local cache (or seeds if first run).
      const cached = readCache();
      setGoalsState(cached.length ? cached : SEED_GOALS);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const cloud = await loadGoals(user.id);
        if (!alive) return;
        cloudRef.current = cloud;

        if (cloud.length === 0) {
          // Migrate from local cache (or seeds, if first ever run on this device).
          const local = readCache();
          const toMigrate = local.length > 0 ? local : SEED_GOALS;
          if (!hasSyncedFlag(user.id) && toMigrate.length > 0) {
            await bulkUpsertGoals(user.id, toMigrate);
            cloudRef.current = toMigrate;
            setGoalsState(toMigrate);
            writeCache(toMigrate);
            markSynced(user.id);
          } else {
            setGoalsState([]);
            writeCache([]);
          }
        } else {
          setGoalsState(cloud);
          writeCache(cloud);
          markSynced(user.id);
        }
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user, authLoading]);

  /* ---------- debounced sync to cloud ---------- */

  const flush = useCallback(async () => {
    if (!user) return;
    const next = pendingRef.current;
    pendingRef.current = null;
    if (!next) return;

    const prev = cloudRef.current;
    const prevById = new Map(prev.map((g) => [g.id, g]));
    const nextById = new Map(next.map((g) => [g.id, g]));

    const toUpsert: Goal[] = [];
    for (const g of next) {
      const prior = prevById.get(g.id);
      if (!prior || JSON.stringify(prior) !== JSON.stringify(g)) {
        toUpsert.push(g);
      }
    }
    const toDelete: string[] = [];
    for (const g of prev) {
      if (!nextById.has(g.id)) toDelete.push(g.id);
    }

    if (toUpsert.length === 0 && toDelete.length === 0) return;

    setSyncing(true);
    setError(null);
    try {
      for (const g of toUpsert) {
        await upsertGoal(user.id, g);
      }
      for (const id of toDelete) {
        await deleteGoalByClientId(user.id, id);
      }
      cloudRef.current = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }, [user]);

  const setGoals = useCallback(
    (next: Goal[]) => {
      setGoalsState(next);
      writeCache(next);
      pendingRef.current = next;
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      if (!user) return; // no-op cloud sync when signed out
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        flush();
      }, 500);
    },
    [user, flush],
  );

  // Flush on unload so a quick close doesn't lose the last edit.
  useEffect(() => {
    const onBeforeUnload = () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
        // Best-effort; fetch may be cancelled mid-flight.
        flush();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [flush]);

  return { goals, setGoals, loading, syncing, error, signedIn: !!user };
}

/* ---------- helpers ---------- */

function readCache(): Goal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Goal[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCache(goals: Goal[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  } catch {
    /* quota or disabled — ignore */
  }
}

function syncedKey(userId: string): string {
  return `alfred.goals.synced:${userId}`;
}

function hasSyncedFlag(userId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(syncedKey(userId)) === "1";
}

function markSynced(userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(syncedKey(userId), "1");
}
