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
 * Cloud-backed goals hook — LOCAL CACHE IS THE SOURCE OF TRUTH.
 *
 * Design principles:
 *  1. Local cache is shown IMMEDIATELY on mount (no blank flash).
 *  2. Cloud is loaded in the background to pick up goals added on other devices.
 *  3. For the same user on the same device, LOCAL ALWAYS WINS over cloud.
 *     Cloud can only ADD goals that don't exist locally.
 *  4. Every mutation writes to localStorage synchronously, then queues a
 *     debounced cloud upsert (500 ms). Even if the upsert never fires
 *     (tab killed, offline), the next load finds local data and pushes it.
 *  5. We never write [] to localStorage unless the user explicitly clears goals.
 */
export function useCloudGoals(): {
  goals: Goal[];
  setGoals: (next: Goal[]) => void;
  loadStarterTemplate: () => void;
  loading: boolean;
  syncing: boolean;
  error: string | null;
  signedIn: boolean;
} {
  const { user, loading: authLoading } = useAuth();

  // Always start with whatever is in the local cache — no blank flash.
  const [goals, setGoalsState] = useState<Goal[]>(() => readCache());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cloudRef = useRef<Goal[]>([]);
  const debounceRef = useRef<number | null>(null);
  const pendingRef = useRef<Goal[] | null>(null);

  /* ---------- initial fetch + background cloud sync ---------- */

  useEffect(() => {
    let alive = true;
    if (authLoading) return;

    if (!user) {
      // Not signed in — local cache is all we have.
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

        const local = readCache();
        const localById = new Map(local.map((g) => [g.id, g]));

        console.log(`[Goals] Loaded ${cloud.length} cloud / ${local.length} local goals`);

        if (cloud.length === 0 && local.length === 0) {
          // Brand-new account with no data anywhere.
          setLoading(false);
          return;
        }

        if (cloud.length === 0) {
          // Cloud is empty but local has goals → push them up.
          console.log(`[Goals] Cloud empty — pushing ${local.length} local goals to cloud`);
          setGoalsState(local);
          writeCache(local);
          setCacheOwner(user.id);
          bulkUpsertGoals(user.id, local)
            .then(() => { setLastSyncTime(user.id); console.log("[Goals] Initial push to cloud ✓"); })
            .catch((e) => { console.error("[Goals] Initial push FAILED:", e); });
          cloudRef.current = local;
          setLoading(false);
          return;
        }

        // ── Merge strategy: LOCAL ALWAYS WINS for goals on this device. ──
        //
        // Cloud can only ADD goals that don't exist locally (from another device).
        // We never replace a local goal with a cloud version — local is always the
        // source of truth for this device. Any differences get pushed to cloud in
        // the background so cloud catches up.
        //
        // Why this is safe: setGoals() synchronously writes to localStorage before
        // the cloud upsert fires. So localStorage always has the latest state, and
        // we can trust it unconditionally.
        const cloudOnlyGoals = cloud.filter((g) => !localById.has(g.id));
        const finalGoals = cloudOnlyGoals.length > 0
          ? [...local, ...cloudOnlyGoals]
          : local;

        console.log(`[Goals] Merge done → ${finalGoals.length} goals. Local: ${local.length}, cloud-only additions: ${cloudOnlyGoals.length}. Done count: ${finalGoals.filter(g=>g.done).length}`);
        setGoalsState(finalGoals);
        writeCache(finalGoals);
        setCacheOwner(user.id);
        cloudRef.current = cloud;

        // Push any local goals that differ from cloud (including newly done ones
        // that haven't synced yet, or goals modified before last flush).
        const cloudById = new Map(cloud.map((g) => [g.id, g]));
        const toSync = local.filter((g) => {
          const cloudGoal = cloudById.get(g.id);
          if (!cloudGoal) return true; // not in cloud yet
          // Check key fields that matter for persistence
          if (g.done !== cloudGoal.done) return true;
          if ((g.current ?? null) !== (cloudGoal.current ?? null)) return true;
          if ((g.lastCheckIn ?? null) !== (cloudGoal.lastCheckIn ?? null)) return true;
          return false;
        });
        if (toSync.length > 0) {
          console.log(`[Goals] Pushing ${toSync.length} locally-newer goals to cloud…`);
          bulkUpsertGoals(user.id, toSync)
            .then(() => { setLastSyncTime(user.id); console.log("[Goals] Back-sync ✓"); })
            .catch((e) => { console.error("[Goals] Back-sync FAILED:", e); });
        }
      } catch (err) {
        if (!alive) return;
        // On any cloud error — keep showing local cache, don't touch it.
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Sync error: ${msg}`);
        console.error("[useCloudGoals] load failed:", err);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
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
      // Always upsert goals with unconfirmed local mutations, or any changed goal.
      if (!prior || JSON.stringify(prior) !== JSON.stringify(g)) {
        toUpsert.push(g);
      }
    }
    const toDelete: string[] = [];
    for (const g of prev) {
      if (!nextById.has(g.id)) toDelete.push(g.id);
    }

    if (toUpsert.length === 0 && toDelete.length === 0) return;

    console.log(`[Goals] Syncing ${toUpsert.length} upserts, ${toDelete.length} deletes to cloud…`);
    setSyncing(true);
    setError(null);
    try {
      for (const g of toUpsert) {
        await upsertGoal(user.id, g);
        console.log(`[Goals] ✓ Upserted "${g.title}" — done:${g.done} current:${g.current ?? "n/a"}`);
      }
      for (const id of toDelete) {
        await deleteGoalByClientId(user.id, id);
      }
      cloudRef.current = next;
      setLastSyncTime(user.id);
      console.log("[Goals] Cloud sync complete ✓");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Save failed: ${msg}`);
      console.error("[Goals] ❌ Cloud sync FAILED:", err);
    } finally {
      setSyncing(false);
    }
  }, [user]);

  const setGoals = useCallback(
    (next: Goal[]) => {
      const doneCount = next.filter(g => g.done).length;
      console.log(`[Goals] setGoals called — ${next.length} goals, ${doneCount} done`);
      setGoalsState(next);
      writeCache(next);
      // Verify the write landed
      const cached = localStorage.getItem(GOALS_KEY);
      const cachedParsed = cached ? JSON.parse(cached) : [];
      console.log(`[Goals] localStorage written — ${cachedParsed.length} goals cached`);
      if (user) setCacheOwner(user.id);
      pendingRef.current = next;
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      if (!user) return;
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        flush();
      }, 500);
    },
    [user, flush],
  );

  const loadStarterTemplate = useCallback(() => {
    const existing = new Set(goals.map((g) => g.id));
    const additions = SEED_GOALS.filter((g) => !existing.has(g.id)).map((g) => ({
      ...g,
      createdAt: Date.now(),
    }));
    if (additions.length === 0) return;
    setGoals([...goals, ...additions]);
  }, [goals, setGoals]);

  // Flush on unload — best-effort; browser may cancel the fetch.
  useEffect(() => {
    const onBeforeUnload = () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
        flush();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [flush]);

  return { goals, setGoals, loadStarterTemplate, loading, syncing, error, signedIn: !!user };
}

/* ---------- localStorage helpers ---------- */

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
    /* quota or disabled */
  }
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

function lastSyncKey(userId: string): string {
  return `alfred.goals.lastSync:${userId}`;
}

function getLastSyncTime(userId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    return parseInt(localStorage.getItem(lastSyncKey(userId)) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function setLastSyncTime(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(lastSyncKey(userId), String(Date.now()));
  } catch {
    /* quota or disabled */
  }
}
