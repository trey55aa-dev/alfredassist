// Offline mode: use Alfred on this device without an account.
//
// Alfred is local-first — every feature writes to localStorage first and only
// then syncs. So the app is fully usable with no backend at all. This flag
// lets someone in when signing in isn't possible (no account yet, no network,
// or the backend is unreachable) instead of leaving them stuck at a wall they
// cannot get past. Device-local by design: it is NOT in SYNCED_KEYS, because
// "I am working offline here" is a per-device decision.

export const LOCAL_MODE_KEY = "alfred.localMode";

/** Habits cache is stamped with the user id that owns it; null = pre-login. */
const HABITS_CACHE_OWNER_KEY = "alfred.habits.cacheOwner";

export function isLocalMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(LOCAL_MODE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Enter offline mode. Also releases the habits cache back to "no owner" so the
 * data already on this device stays visible — otherwise useCloudHabits treats a
 * cache owned by a signed-in user as untrusted and renders an empty app, which
 * looks exactly like data loss. Releasing it is safe: on a later sign-in the
 * migration path treats an unowned cache as pre-login data and uploads it.
 */
export function enableLocalMode(): void {
  try {
    localStorage.setItem(LOCAL_MODE_KEY, "true");
    localStorage.removeItem(HABITS_CACHE_OWNER_KEY);
  } catch {
    /* quota */
  }
}

export function disableLocalMode(): void {
  try {
    localStorage.removeItem(LOCAL_MODE_KEY);
  } catch {
    /* quota */
  }
}
