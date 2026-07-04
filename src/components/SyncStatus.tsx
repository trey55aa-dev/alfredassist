import { useEffect, useState } from "react";
import { CloudOff, Loader2, AlertTriangle, Check } from "lucide-react";
import { useSyncStatus } from "@/lib/syncStatus";

/**
 * Compact sync indicator for the header. Surfaces cloud save state so a failure
 * is never silent: Offline → Saving… → Sync error (with reason) → a brief "Saved".
 * Renders nothing in the steady, healthy, idle state to stay out of the way.
 */
export function SyncStatus() {
  const { syncing, error, online, lastSyncedAt } = useSyncStatus();
  const [justSaved, setJustSaved] = useState(false);

  // Flash a brief "Saved" tick when a sync completes cleanly.
  useEffect(() => {
    if (!lastSyncedAt || error) return;
    setJustSaved(true);
    const t = setTimeout(() => setJustSaved(false), 2000);
    return () => clearTimeout(t);
  }, [lastSyncedAt, error]);

  if (!online) {
    return (
      <Chip tone="amber" title="You're offline — changes are saved on this device and will sync when you're back.">
        <CloudOff className="h-3 w-3" /> Offline
      </Chip>
    );
  }
  if (error) {
    return (
      <Chip tone="red" title={error}>
        <AlertTriangle className="h-3 w-3" /> Sync error
      </Chip>
    );
  }
  if (syncing) {
    return (
      <Chip tone="muted" title="Saving your changes to the cloud…">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </Chip>
    );
  }
  if (justSaved) {
    return (
      <Chip tone="teal" title="All changes saved.">
        <Check className="h-3 w-3" /> Saved
      </Chip>
    );
  }
  return null;
}

const TONES: Record<string, string> = {
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  red: "border-destructive/40 bg-destructive/10 text-destructive",
  muted: "border-border/60 bg-white/5 text-muted-foreground",
  teal: "border-teal/30 bg-teal/10 text-teal",
};

function Chip({
  tone,
  title,
  children,
}: {
  tone: keyof typeof TONES | string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] tracking-wider uppercase ${TONES[tone] ?? TONES.muted}`}
    >
      {children}
    </span>
  );
}
