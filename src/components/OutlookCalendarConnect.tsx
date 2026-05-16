import { useEffect, useState } from "react";
import { CalendarCheck, CalendarX, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  OUTLOOK_CONNECTED_CHANGED,
  connectOutlookCalendar,
  disconnectOutlookCalendar,
  isOutlookConfigured,
  isOutlookConnected,
} from "@/lib/outlookCalendar";

interface Props {
  onSynced?: () => void;
}

export function OutlookCalendarConnect({ onSynced }: Props) {
  const { toast } = useToast();
  const [connected, setConnected] = useState(() => isOutlookConnected());
  const [busy, setBusy] = useState(false);
  const configured = isOutlookConfigured();

  useEffect(() => {
    const sync = () => setConnected(isOutlookConnected());
    window.addEventListener(OUTLOOK_CONNECTED_CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(OUTLOOK_CONNECTED_CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!configured) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-dashed border-border/60 px-3 py-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
        <CalendarX className="h-3.5 w-3.5" />
        Outlook · not configured
      </div>
    );
  }

  const handleConnect = async () => {
    setBusy(true);
    try {
      await connectOutlookCalendar();
      setConnected(true);
      toast({
        title: "Outlook connected",
        description: "Today's events are syncing in.",
      });
      onSynced?.();
    } catch (err) {
      toast({
        title: "Could not connect Outlook",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await disconnectOutlookCalendar();
      setConnected(false);
      toast({ title: "Outlook disconnected" });
      onSynced?.();
    } catch (err) {
      toast({
        title: "Disconnect failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (!connected) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleConnect}
        disabled={busy}
        className="border-sky-500/40 text-sky-400 hover:text-sky-300 hover:bg-muted/40"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        ) : (
          <CalendarCheck className="h-3.5 w-3.5 mr-1.5" />
        )}
        Connect Outlook
      </Button>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-sky-400">
        <CalendarCheck className="h-3.5 w-3.5" />
        Outlook · synced
      </span>
      <button
        type="button"
        onClick={() => onSynced?.()}
        className="text-muted-foreground/70 hover:text-sky-400 transition-colors p-1"
        aria-label="Refresh now"
        title="Refresh now"
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={handleDisconnect}
        disabled={busy}
        className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-destructive transition-colors"
      >
        Disconnect
      </button>
    </div>
  );
}
