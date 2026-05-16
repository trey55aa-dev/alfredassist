import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getPermission,
  isEnabled,
  isSupported,
  requestPermission,
  setEnabled,
} from "@/lib/notifications";

export function NotificationToggle() {
  const { toast } = useToast();
  const [perm, setPerm] = useState(getPermission());
  const [enabled, setEnabledState] = useState(isEnabled());

  useEffect(() => {
    setPerm(getPermission());
    setEnabledState(isEnabled());
  }, []);

  if (!isSupported()) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
        <BellOff className="h-3.5 w-3.5" />
        Notifications · unsupported
      </span>
    );
  }

  const handleEnable = async () => {
    const result = await requestPermission();
    setPerm(result);
    setEnabledState(result === "granted");
    if (result === "granted") {
      toast({ title: "Notifications on", description: "I'll prompt you 5 min before each event." });
    } else if (result === "denied") {
      toast({
        title: "Notifications blocked",
        description: "Re-enable in your browser site settings.",
        variant: "destructive",
      });
    }
  };

  const handleToggleOff = () => {
    setEnabled(false);
    setEnabledState(false);
    toast({ title: "Notifications muted" });
  };

  if (perm === "denied") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-destructive">
        <BellOff className="h-3.5 w-3.5" />
        Blocked
      </span>
    );
  }

  if (perm !== "granted" || !enabled) {
    return (
      <button
        type="button"
        onClick={handleEnable}
        className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 px-3 py-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-gold hover:bg-muted/40 transition-colors"
      >
        <Bell className="h-3.5 w-3.5" />
        Enable notifications
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-gold">
        <BellRing className="h-3.5 w-3.5" />
        Notifications on
      </span>
      <button
        type="button"
        onClick={handleToggleOff}
        className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-destructive transition-colors"
      >
        Mute
      </button>
    </span>
  );
}
