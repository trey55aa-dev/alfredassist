import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  isPushSupported,
  isSubscribed,
  subscribeToPush,
  unsubscribeFromPush,
  type PushReason,
} from "@/lib/pushNotifications";

const REASON: Record<PushReason, string> = {
  unsupported: "This browser doesn't support push notifications.",
  denied: "Notifications are blocked — enable them in your browser settings for this site.",
  dismissed: "Permission dismissed. Tap again when you're ready.",
  "no-vapid-key": "Push isn't configured yet (missing VAPID key).",
  "not-signed-in": "Sign in first so Alfred knows who to brief.",
  "save-failed": "Couldn't save your subscription — try again.",
};

/** Opt in/out of Alfred's morning & evening push briefings. Hidden where unsupported. */
export function PushToggle() {
  const { user } = useAuth();
  const [supported] = useState(() => isPushSupported());
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (supported) isSubscribed().then(setSubscribed);
  }, [supported]);

  if (!supported) return null;

  const enable = async () => {
    setBusy(true);
    const r = await subscribeToPush(user?.id);
    setBusy(false);
    if (r.ok) {
      setSubscribed(true);
      toast.success("Alfred will brief you each morning and evening.");
    } else {
      toast.error(r.detail ? `${REASON[r.reason!]} (${r.detail})` : REASON[r.reason ?? "save-failed"]);
    }
  };

  const disable = async () => {
    setBusy(true);
    await unsubscribeFromPush();
    setSubscribed(false);
    setBusy(false);
    toast("Briefings turned off.");
  };

  return (
    <button
      type="button"
      onClick={subscribed ? disable : enable}
      disabled={busy}
      title={subscribed ? "Alfred's briefings are on — tap to turn off" : "Get Alfred's briefings even when the app is closed"}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-mono tracking-wider uppercase transition-colors disabled:opacity-60 ${
        subscribed
          ? "border-gold/40 bg-gold/15 text-gold hover:bg-gold/25"
          : "border-border/60 text-muted-foreground hover:text-gold hover:border-gold/30"
      }`}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : subscribed ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
      {subscribed ? "Briefings on" : "Enable briefings"}
    </button>
  );
}
