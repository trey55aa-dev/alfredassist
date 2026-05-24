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
 * Cloud-backed goals hook with an ownership-aware localStorage cache.
 *
 * Behavior:
 *  - Mount: fetch from Supabase if signed in. The local cache is only trusted
 *    when it was written by the *current* user (or by the anonymous browser
 *    session if no one has signed in yet on this device).
 *  - First sign-in:
 *      • cloud has data → use cloud (cache is replaced).
 *      • cloud empty + cache belongs to current user → push the cache up.
 *      • cloud empty + cache belongs to someone else (or no one) → start empty.
 *        We do NOT auto-seed with SEED_GOALS — that's opt-in via loadStarterTemplate.
 *  - Mutations: optimistic local update + cache, then a debounced diff/upsert/delete
 *    against the last-known cloud state. Last-write-wins; fine for single-user.
 *  - Offline / not signed in: returns the cached data (if any) or empty;
 *    syncing flag stays false.
 */
export function useCloudGoals(): {
  goals: Goal[];
  setGoals: (next: Goal[]) => void;
  /** Append SEED_GOALS to the current list, skipping client_ids the user already has. */
  loadStarterTemplate: () => void;
  loading: boolean;
  syncing: boolean;
  error: string | null;
  signedIn: boolean;
} {
  const { user, loading: authLoading } = useAuth();
  // Show cache immediately only if it belongs to no-one yet (pre-login) — we
  // can't know the new user's id at this point, so we just start empty when
  // there's an owner and let the effect resolve it.
  const [goals, setGoalsState] = useState<Goal[]>(() =>
    getCacheOwner() === null ? readCache() : [],
  );
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
      // Not signed in. Trust the cache only if no owner is stamped on it
      // (i.e. this browser hasn't been used by a signed-in account yet).
      const cached = getCacheOwner() === null ? readCache() : [];
      setGoalsState(cached);
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

        if (cloud.length > 0) {
          setGoalsState(cloud);
          writeCache(cloud);
          setCacheOwner(user.id);
          markSynced(user.id);
          return;
        }

        // Cloud is empty. Decide if we should migrate the local cache:
        // only if it was written by THIS user (or by no one — pre-login data).
        const owner = getCacheOwner();
        const cached = readCache();
        const cacheBelongsHere =
          (owner === null || owner === user.id) && cached.length > 0;

        if (cacheBelongsHere && !hasSyncedFlag(user.id)) {
          await bulkUpsertGoals(user.id, cached);
          cloudRef.current = cached;
          setGoalsState(cached);
          writeCache(cached);
          setCacheOwner(user.id);
          markSynced(user.id);
        } else {
          // Brand-new account, or this browser belongs to a different user.
          // Start empty; the empty-state UI offers SEED_GOALS as an opt-in template.
          setGoalsState([]);
          writeCache([]);
          setCacheOwner(user.id);
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
      if (user) setCacheOwner(user.id);
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

  const loadStarterTemplate = useCallback(() => {
    // Merge SEED_GOALS into current goals, skipping any client_ids the user
    // already has. Lets you tap "load template" without nuking existing goals.
    const existing = new Set(goals.map((g) => g.id));
    const additions = SEED_GOALS.filter((g) => !existing.has(g.id)).map((g) => ({
      ...g,
      createdAt: Date.now(),
    }));
    if (additions.length === 0) return;
    setGoals([...goals, ...additions]);
  }, [goals, setGoals]);

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

  return {
    goals,
    setGoals,
    loadStarterTemplate,
    loading,
    syncing,
    error,
    signedIn: !!user,
  };
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

const CACHE_OWNER_KEY = "alfred.goals.cacheOwner";

function getCacheOwner(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CACHE_OWNER_KEY);
}

function setCacheOwner(userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CACHE_OWNER_KEY, userId);
}
