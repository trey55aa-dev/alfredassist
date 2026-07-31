// Web Push subscription management (client side). Registers the browser with a
// push service using the VAPID public key and stores the subscription in
// public.push_subscriptions so the send-briefings edge function can reach it —
// even when the app/tab is closed.

import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type PushReason =
  | "unsupported"
  | "needs-install"
  | "denied"
  | "dismissed"
  | "no-vapid-key"
  | "not-signed-in"
  | "save-failed";

/** iPhone/iPad, including iPadOS 13+ which reports itself as a Mac. */
function isIosLike(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

/** Running as an installed web app rather than a browser tab. */
export function isInstalledWebApp(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * iOS only delivers Web Push to apps added to the Home Screen — in a plain
 * Safari tab the APIs exist but subscribing never works. macOS web apps (and
 * Safari on macOS) have no such requirement, so this is gated to iOS only.
 */
export function needsHomeScreenInstall(): boolean {
  return isIosLike() && !isInstalledWebApp();
}

export interface PushResult {
  ok: boolean;
  reason?: PushReason;
  detail?: string;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

/** Is this browser currently subscribed? */
export async function isSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription());
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Request permission, subscribe, and persist the subscription for this user. */
export async function subscribeToPush(userId: string | undefined): Promise<PushResult> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  // Fail fast with actionable guidance instead of a confusing subscribe error.
  if (needsHomeScreenInstall()) return { ok: false, reason: "needs-install" };
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: "no-vapid-key" };
  if (!userId) return { ok: false, reason: "not-signed-in" };

  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    return { ok: false, reason: perm === "denied" ? "denied" : "dismissed" };
  }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, reason: "save-failed", detail: "Incomplete subscription" };
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, reason: "save-failed", detail: error.message };
  return { ok: true };
}

/** Unsubscribe this browser and remove the stored row. */
export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  } catch {
    /* best-effort */
  }
}
