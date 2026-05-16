import { useEffect, useState } from "react";
import { CalendarCheck, CalendarX, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  GOOGLE_CONNECTED_CHANGED,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  isGoogleConfigured,
  isGoogleConnected,
} from "@/lib/googleCalendar";

interface Props {
  /** Called after a successful connect or manual sync. */
  onSynced?: () => void;
}

export function GoogleCalendarConnect({ onSynced }: Props) {
  const { toast } = useToast();
  const [connected, setConnected] = useState(() => isGoogleConnected());
  const [busy, setBusy] = useState(false);
  const configured = isGoogleConfigured();

  useEffect(() => {
    const sync = () => setConnected(isGoogleConnected());
    window.addEventListener(GOOGLE_CONNECTED_CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(GOOGLE_CONNECTED_CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!configured) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-dashed border-border/60 px-3 py-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
        <CalendarX className="h-3.5 w-3.5" />
        Google Calendar · not configured
      </div>
    );
  }

  const handleConnect = async () => {
    setBusy(true);
    try {
      await connectGoogleCalendar();
      setConnected(true);
      toast({
        title: "Google Calendar connected",
        description: "Today's events are syncing in.",
      });
      onSynced?.();
    } catch (err) {
      toast({
        title: "Could not connect",
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
      await disconnectGoogleCalendar();
      setConnected(false);
      toast({ title: "Google Calendar disconnected" });
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
        className="border-gold/40 text-gold hover:text-gold hover:bg-muted/40"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        ) : (
          <CalendarCheck className="h-3.5 w-3.5 mr-1.5" />
        )}
        Connect Google Calendar
      </Button>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-gold">
        <CalendarCheck className="h-3.5 w-3.5" />
        Google · synced
      </span>
      <button
        type="button"
        onClick={() => onSynced?.()}
        className="text-muted-foreground/70 hover:text-gold transition-colors p-1"
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
