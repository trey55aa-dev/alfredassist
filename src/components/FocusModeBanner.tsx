import { useEffect, useState } from "react";
import { Focus, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useFocusMode } from "@/hooks/useFocusMode";
import {
  formatFocusElapsed,
  iosShortcutUrl,
  stopFocus,
} from "@/lib/focusMode";
import { LaunchDeepLink } from "@/components/FocusModeStarter";

/**
 * Persistent strip across the top of every page while a focus session is active.
 * Shows the task, elapsed time, the user's commitment list, and "Quit focus".
 */
export function FocusModeBanner() {
  const { toast } = useToast();
  const state = useFocusMode();
  const [, setTick] = useState(0);

  // Re-render every 30s so the "23 min" elapsed label stays current.
  useEffect(() => {
    if (!state.active) return;
    const i = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(i);
  }, [state.active]);

  if (!state.active) return null;

  const elapsed = formatFocusElapsed(state);
  const shortcut = iosShortcutUrl(state.iosShortcutName);

  const handleQuit = () => {
    stopFocus();
    toast({ title: "Focus ended", description: "Welcome back." });
  };

  return (
    <div className="sticky top-0 z-40 border-b border-gold/30 bg-gradient-to-r from-gold/15 via-gold/10 to-gold/15 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Focus className="h-4 w-4 text-gold shrink-0" />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-gold">
                Focused
              </span>
              {state.taskTitle && (
                <span className="font-display text-sm text-foreground truncate max-w-md">
                  on {state.taskTitle}
                </span>
              )}
              <span className="font-mono text-[10px] tracking-wider text-muted-foreground">
                · {elapsed}
              </span>
            </div>
            {state.commitments.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">
                  Avoid:
                </span>
                {state.commitments.slice(0, 8).map((c) => (
                  <span
                    key={c}
                    className="inline-block px-1.5 py-0.5 rounded border border-gold/30 bg-background/40 text-gold/90 text-[10px] font-mono tracking-[0.1em]"
                  >
                    {c}
                  </span>
                ))}
                {state.commitments.length > 8 && (
                  <span className="font-mono text-[9px] text-muted-foreground">
                    +{state.commitments.length - 8} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {state.freedomUrl && (
            <LaunchDeepLink href={state.freedomUrl} label="Freedom" />
          )}
          {shortcut && (
            <LaunchDeepLink href={shortcut} label="iOS Focus" />
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 font-mono text-[10px] tracking-[0.15em] uppercase text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                aria-label="Quit focus"
              >
                <X className="h-3 w-3" />
                Quit focus
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>End this focus session?</AlertDialogTitle>
                <AlertDialogDescription>
                  {state.taskTitle
                    ? `You committed to focusing on "${state.taskTitle}". The commitment list and dim sidebar will go back to normal.`
                    : "Your commitment list and dim sidebar will go back to normal."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Stay focused</AlertDialogCancel>
                <AlertDialogAction onClick={handleQuit}>
                  Yes, end focus
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
