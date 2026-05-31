import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  bulkUpsertCustomLists,
  deleteCustomListByClientId,
  loadCustomLists,
  upsertCustomList,
} from "@/lib/customListsRepo";
import { CUSTOM_LISTS_KEY, SEED_LISTS, type CustomList } from "@/lib/customLists";

/**
 * Cloud-backed custom lists hook. Same pattern as useCloudGoals /
 * useCloudHabits: cloud is source of truth on sign-in; ownership-aware
 * local cache prevents cross-user leaks; mutations are optimistic with
 * a debounced diff push.
 */
export function useCloudCustomLists(): {
  lists: CustomList[];
  setLists: (next: CustomList[]) => void;
  loadStarterLists: () => void;
  loading: boolean;
  syncing: boolean;
  error: string | null;
  signedIn: boolean;
} {
  const { user, loading: authLoading } = useAuth();
  const [lists, setListsState] = useState<CustomList[]>(() =>
    getCacheOwner() === null ? readCache() : [],
  );
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cloudRef = useRef<CustomList[]>([]);
  const debounceRef = useRef<number | null>(null);
  const pendingRef = useRef<CustomList[] | null>(null);

  useEffect(() => {
    let alive = true;
    if (authLoading) return;
    if (!user) {
      const cached = getCacheOwner() === null ? readCache() : [];
      setListsState(cached);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const cloud = await loadCustomLists(user.id);
        if (!alive) return;
        cloudRef.current = cloud;
        if (cloud.length > 0) {
          setListsState(cloud);
          writeCache(cloud);
          setCacheOwner(user.id);
          markSynced(user.id);
          return;
        }
        const owner = getCacheOwner();
        const cached = readCache();
        const belongs = (owner === null || owner === user.id) && cached.length > 0;
        if (belongs && !hasSyncedFlag(user.id)) {
          await bulkUpsertCustomLists(user.id, cached);
          cloudRef.current = cached;
          setListsState(cached);
          writeCache(cached);
          setCacheOwner(user.id);
          markSynced(user.id);
        } else {
          setListsState([]);
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

  const flush = useCallback(async () => {
    if (!user) return;
    const next = pendingRef.current;
    pendingRef.current = null;
    if (!next) return;
    const prev = cloudRef.current;
    const prevById = new Map(prev.map((l) => [l.id, l]));
    const nextById = new Map(next.map((l) => [l.id, l]));
    const toUpsert: CustomList[] = [];
    for (const l of next) {
      const prior = prevById.get(l.id);
      if (!prior || JSON.stringify(prior) !== JSON.stringify(l)) {
        toUpsert.push(l);
      }
    }
    const toDelete: string[] = [];
    for (const l of prev) if (!nextById.has(l.id)) toDelete.push(l.id);
    if (toUpsert.length === 0 && toDelete.length === 0) return;

    setSyncing(true);
    setError(null);
    try {
      for (const l of toUpsert) await upsertCustomList(user.id, l);
      for (const id of toDelete) await deleteCustomListByClientId(user.id, id);
      cloudRef.current = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }, [user]);

  const setLists = useCallback(
    (next: CustomList[]) => {
      setListsState(next);
      writeCache(next);
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

  const loadStarterLists = useCallback(() => {
    const existing = new Set(lists.map((l) => l.id));
    const additions = SEED_LISTS.filter((l) => !existing.has(l.id));
    if (additions.length === 0) return;
    setLists([...lists, ...additions]);
  }, [lists, setLists]);

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
    lists,
    setLists,
    loadStarterLists,
    loading,
    syncing,
    error,
    signedIn: !!user,
  };
}

/* helpers */
function readCache(): CustomList[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_LISTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomList[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function writeCache(lists: CustomList[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CUSTOM_LISTS_KEY, JSON.stringify(lists));
  } catch { /* ignore */ }
}
const CACHE_OWNER_KEY = "alfred.customLists.cacheOwner";
function getCacheOwner(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CACHE_OWNER_KEY);
}
function setCacheOwner(userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CACHE_OWNER_KEY, userId);
}
function syncedKey(userId: string): string {
  return `alfred.customLists.synced:${userId}`;
}
function hasSyncedFlag(userId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(syncedKey(userId)) === "1";
}
function markSynced(userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(syncedKey(userId), "1");
}
