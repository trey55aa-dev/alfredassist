import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  addHabitLog,
  bulkUpsertHabitLogs,
  bulkUpsertHabits,
  deleteHabitByClientId,
  loadHabitLogs,
  loadHabits,
  removeHabitLog,
  upsertHabit,
} from "@/lib/habitsRepo";
import {
  HABITS_KEY,
  HABIT_LOGS_KEY,
  SEED_HABITS,
  type Habit,
  type HabitLog,
} from "@/lib/habits";
import { reportSync } from "@/lib/syncStatus";

/**
 * Cloud-backed habits + habit-logs hook with ownership-aware localStorage cache.
 *
 * Same shape as useCloudGoals — drop-in replacement for the two
 * useLocalStorage calls Dashboard/Checklist were doing. Both habits and logs
 * sync; mutations are optimistic + locally cached, with a debounced diff push
 * against the last-known cloud snapshot.
 *
 * Habit logs are append-or-delete (one row per [user, habit, day]). The
 * differ figures out adds vs deletes by string-key diffing.
 */
export function useCloudHabits(): {
  habits: Habit[];
  setHabits: (next: Habit[]) => void;
  habitLogs: HabitLog[];
  setHabitLogs: (next: HabitLog[]) => void;
  /** Append seed habits, skipping client_ids the user already has. */
  loadStarterHabits: () => void;
  loading: boolean;
  syncing: boolean;
  error: string | null;
  signedIn: boolean;
} {
  const { user, loading: authLoading } = useAuth();
  const startOwned = getCacheOwner() === null;
  const [habits, setHabitsState] = useState<Habit[]>(() =>
    startOwned ? readHabitsCache() : [],
  );
  const [habitLogs, setHabitLogsState] = useState<HabitLog[]>(() =>
    startOwned ? readLogsCache() : [],
  );
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cloudHabitsRef = useRef<Habit[]>([]);
  const cloudLogsRef = useRef<HabitLog[]>([]);
  const debounceRef = useRef<number | null>(null);
  const pendingHabitsRef = useRef<Habit[] | null>(null);
  const pendingLogsRef = useRef<HabitLog[] | null>(null);

  /* ---------- initial fetch + first-sign-in migration ---------- */

  useEffect(() => {
    let alive = true;
    if (authLoading) return;
    if (!user) {
      const owner = getCacheOwner();
      const trusted = owner === null;
      setHabitsState(trusted ? readHabitsCache() : []);
      setHabitLogsState(trusted ? readLogsCache() : []);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [cloudHabits, cloudLogs] = await Promise.all([
          loadHabits(user.id),
          loadHabitLogs(user.id),
        ]);
        if (!alive) return;

        if (cloudHabits.length > 0 || cloudLogs.length > 0) {
          // Cloud is the source of truth.
          cloudHabitsRef.current = cloudHabits;
          cloudLogsRef.current = cloudLogs;
          setHabitsState(cloudHabits);
          setHabitLogsState(cloudLogs);
          writeHabitsCache(cloudHabits);
          writeLogsCache(cloudLogs);
          setCacheOwner(user.id);
          markSynced(user.id);
          return;
        }

        // Cloud empty. Migrate the local cache only if it belongs to THIS user
        // (or to no one — pre-login data).
        const owner = getCacheOwner();
        const cachedHabits = readHabitsCache();
        const cachedLogs = readLogsCache();
        const cacheBelongs =
          (owner === null || owner === user.id) &&
          (cachedHabits.length > 0 || cachedLogs.length > 0);

        if (cacheBelongs && !hasSyncedFlag(user.id)) {
          await Promise.all([
            bulkUpsertHabits(user.id, cachedHabits),
            bulkUpsertHabitLogs(user.id, cachedLogs),
          ]);
          cloudHabitsRef.current = cachedHabits;
          cloudLogsRef.current = cachedLogs;
          setHabitsState(cachedHabits);
          setHabitLogsState(cachedLogs);
          writeHabitsCache(cachedHabits);
          writeLogsCache(cachedLogs);
          setCacheOwner(user.id);
          markSynced(user.id);
        } else {
          setHabitsState([]);
          setHabitLogsState([]);
          writeHabitsCache([]);
          writeLogsCache([]);
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

  /* ---------- debounced sync ---------- */

  const flush = useCallback(async () => {
    if (!user) return;
    const nextHabits = pendingHabitsRef.current ?? cloudHabitsRef.current;
    const nextLogs = pendingLogsRef.current ?? cloudLogsRef.current;
    pendingHabitsRef.current = null;
    pendingLogsRef.current = null;

    setSyncing(true);
    setError(null);
    reportSync({ syncing: true });
    try {
      // Habits diff: upsert changed, delete missing.
      const prevHabits = cloudHabitsRef.current;
      const prevHabitsById = new Map(prevHabits.map((h) => [h.id, h]));
      const nextHabitsById = new Map(nextHabits.map((h) => [h.id, h]));
      const habitsToUpsert: Habit[] = [];
      for (const h of nextHabits) {
        const prior = prevHabitsById.get(h.id);
        if (!prior || JSON.stringify(prior) !== JSON.stringify(h)) {
          habitsToUpsert.push(h);
        }
      }
      const habitsToDelete: string[] = [];
      for (const h of prevHabits) {
        if (!nextHabitsById.has(h.id)) habitsToDelete.push(h.id);
      }
      for (const h of habitsToUpsert) await upsertHabit(user.id, h);
      for (const id of habitsToDelete) await deleteHabitByClientId(user.id, id);

      // Logs diff by (habitId, date) string key.
      const logKey = (l: HabitLog) => `${l.habitId}|${l.date}`;
      const prevLogs = cloudLogsRef.current;
      const prevSet = new Set(prevLogs.map(logKey));
      const nextSet = new Set(nextLogs.map(logKey));
      const logsToAdd = nextLogs.filter((l) => !prevSet.has(logKey(l)));
      const logsToRemove = prevLogs.filter((l) => !nextSet.has(logKey(l)));
      for (const l of logsToAdd) await addHabitLog(user.id, l);
      for (const l of logsToRemove) await removeHabitLog(user.id, l);

      cloudHabitsRef.current = nextHabits;
      cloudLogsRef.current = nextLogs;
      reportSync({ syncing: false, error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      reportSync({ syncing: false, error: `Habits — ${msg}` });
    } finally {
      setSyncing(false);
    }
  }, [user]);

  const scheduleFlush = useCallback(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!user) return;
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      flush();
    }, 500);
  }, [user, flush]);

  const setHabits = useCallback(
    (next: Habit[]) => {
      setHabitsState(next);
      writeHabitsCache(next);
      if (user) setCacheOwner(user.id);
      pendingHabitsRef.current = next;
      scheduleFlush();
    },
    [user, scheduleFlush],
  );

  const setHabitLogs = useCallback(
    (next: HabitLog[]) => {
      setHabitLogsState(next);
      writeLogsCache(next);
      if (user) setCacheOwner(user.id);
      pendingLogsRef.current = next;
      scheduleFlush();
    },
    [user, scheduleFlush],
  );

  const loadStarterHabits = useCallback(() => {
    const existing = new Set(habits.map((h) => h.id));
    const additions = SEED_HABITS.filter((h) => !existing.has(h.id)).map(
      (h) => ({ ...h, createdAt: Date.now() }),
    );
    if (additions.length === 0) return;
    setHabits([...habits, ...additions]);
  }, [habits, setHabits]);

  // Best-effort flush on tab close.
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

  return {
    habits,
    setHabits,
    habitLogs,
    setHabitLogs,
    loadStarterHabits,
    loading,
    syncing,
    error,
    signedIn: !!user,
  };
}

/* ---------- localStorage helpers ---------- */

function readHabitsCache(): Habit[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HABITS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Habit[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHabitsCache(habits: Habit[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
  } catch {
    /* ignore */
  }
}

function readLogsCache(): HabitLog[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HABIT_LOGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HabitLog[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLogsCache(logs: HabitLog[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HABIT_LOGS_KEY, JSON.stringify(logs));
  } catch {
    /* ignore */
  }
}

const CACHE_OWNER_KEY = "alfred.habits.cacheOwner";

function getCacheOwner(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CACHE_OWNER_KEY);
}

function setCacheOwner(userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CACHE_OWNER_KEY, userId);
}

function syncedKey(userId: string): string {
  return `alfred.habits.synced:${userId}`;
}

function hasSyncedFlag(userId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(syncedKey(userId)) === "1";
}

function markSynced(userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(syncedKey(userId), "1");
}
