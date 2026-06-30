import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  bulkUpsertGoals,
  deleteGoalByClientId,
  loadGoalsWithMeta,
  upsertGoal,
  type LoadedGoal,
} from "@/lib/goalsRepo";
import { GOALS_KEY, type Goal, SEED_GOALS } from "@/lib/goals";

/* ---------- cross-device reconcile (pure, exported for testing) ---------- */

/** Compare a goal's content, ignoring the local-only `localUpdatedAt` stamp. */
function stableGoalJson(g: Goal): string {
  const { localUpdatedAt: _omit, ...rest } = g;
  return JSON.stringify(rest);
}

export function goalContentChanged(a: Goal, b: Goal): boolean {
  return stableGoalJson(a) !== stableGoalJson(b);
}

/**
 * Reconcile local goals against the cloud using per-goal last-write-wins.
 *
 * Each local goal carries `localUpdatedAt` (epoch-ms of its last edit on THIS
 * device); each cloud goal carries `cloudUpdatedAt` (epoch-ms of the last edit
 * pushed from ANY device). For a goal present on both sides we keep whichever is
 * newer. Crucially, a goal the local device never edited (localUpdatedAt = 0/old)
 * yields to the cloud — so a goal you crossed off on another device finally shows
 * as done here, instead of the old "local always wins" rule silently dropping it.
 *
 * Returns the merged list plus the goals whose local copy is newer and therefore
 * needs pushing back up to the cloud.
 */
export function reconcileGoals(
  local: Goal[],
  cloud: LoadedGoal[],
): { finalGoals: Goal[]; toSync: Goal[] } {
  const localById = new Map(local.map((g) => [g.id, g]));
  const cloudMetaById = new Map(cloud.map((l) => [l.goal.id, l]));

  const finalGoals: Goal[] = [];
  const toSync: Goal[] = [];

  for (const lg of local) {
    const meta = cloudMetaById.get(lg.id);
    if (!meta) {
      // Exists only on this device (added locally, not yet pushed) → keep & push.
      finalGoals.push(lg);
      toSync.push(lg);
      continue;
    }
    const localTs = lg.localUpdatedAt ?? 0;
    if (localTs > meta.cloudUpdatedAt && goalContentChanged(lg, meta.goal)) {
      // Local edit is strictly newer than cloud → local wins, push it up.
      finalGoals.push(lg);
      toSync.push(lg);
    } else {
      // Cloud is newer (or this device never edited it) → adopt cloud, but keep
      // local-only fields the DB doesn't persist (financialType).
      finalGoals.push({
        ...meta.goal,
        financialType: lg.financialType,
        localUpdatedAt: meta.cloudUpdatedAt,
      });
    }
  }

  // Goals that exist only in the cloud (added/owned by another device).
  for (const { goal } of cloud) {
    if (!localById.has(goal.id)) finalGoals.push(goal);
  }

  return { finalGoals, toSync };
}

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
  // Last goals we handed out — baseline for detecting which goals changed so we
  // can stamp localUpdatedAt on them (drives cross-device last-write-wins).
  const lastGoalsRef = useRef<Goal[]>(goals);

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
        const loaded = await loadGoalsWithMeta(user.id);
        if (!alive) return;
        const cloud = loaded.map((l) => l.goal);
        cloudRef.current = cloud;

        const local = readCache();

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
          lastGoalsRef.current = local;
          bulkUpsertGoals(user.id, local)
            .then(() => { setLastSyncTime(user.id); console.log("[Goals] Initial push to cloud ✓"); })
            .catch((e) => { console.error("[Goals] Initial push FAILED:", e); });
          cloudRef.current = local;
          setLoading(false);
          return;
        }

        // ── Cross-device merge: per-goal last-write-wins by timestamp. ──
        // Unlike the old "local always wins" rule (which silently dropped edits
        // made on other devices, e.g. a goal crossed off on your computer never
        // showing as done on your phone), we keep whichever side edited a goal
        // most recently. See reconcileGoals() for details.
        const { finalGoals, toSync } = reconcileGoals(local, loaded);

        console.log(`[Goals] Merge done → ${finalGoals.length} goals (${finalGoals.filter(g=>g.done).length} done). ${toSync.length} local-newer to push.`);
        setGoalsState(finalGoals);
        writeCache(finalGoals);
        setCacheOwner(user.id);
        lastGoalsRef.current = finalGoals;

        if (toSync.length > 0) {
          console.log(`[Goals] Pushing ${toSync.length} locally-newer goals to cloud…`);
          bulkUpsertGoals(user.id, toSync)
            .then(() => { cloudRef.current = finalGoals; setLastSyncTime(user.id); console.log("[Goals] Back-sync ✓"); })
            .catch((e) => { console.error("[Goals] Back-sync FAILED:", e); });
        } else {
          cloudRef.current = finalGoals;
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
      // Stamp localUpdatedAt on any goal whose content changed since we last
      // handed it out, so the cross-device merge can tell which side is newer.
      // This is a safety net independent of call sites, so every mutation gets a
      // fresh timestamp even if a caller forgets to set one.
      const now = Date.now();
      const prevById = new Map(lastGoalsRef.current.map((g) => [g.id, g]));
      const stamped = next.map((g) => {
        const before = prevById.get(g.id);
        if (before && !goalContentChanged(before, g)) return g;
        return { ...g, localUpdatedAt: now };
      });
      lastGoalsRef.current = stamped;

      const doneCount = stamped.filter((g) => g.done).length;
      console.log(`[Goals] setGoals called — ${stamped.length} goals, ${doneCount} done`);
      setGoalsState(stamped);
      writeCache(stamped);
      if (user) setCacheOwner(user.id);
      pendingRef.current = stamped;
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
