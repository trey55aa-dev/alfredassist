import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { hydrateEventsFromCloud, setEventsUserId } from "@/lib/agendaStore";

/**
 * Wires the (non-React) agendaStore write-through layer to the current auth
 * session: caches the user id so mutations mirror to Supabase, and hydrates
 * the local cache from the cloud once on sign-in.
 *
 * Mount this once near the top of the tree (AppLayout) — agendaStore's
 * functions are global, so a single instance covers every consumer.
 */
export function useEventsSync(): void {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    setEventsUserId(user?.id ?? null);
    if (user) {
      hydrateEventsFromCloud(user.id);
    }
  }, [user, loading]);
}
