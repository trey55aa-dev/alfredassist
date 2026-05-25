import { useState } from "react";
import { Focus, ExternalLink } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useFocusMode } from "@/hooks/useFocusMode";
import {
  iosShortcutUrl,
  patchFocusState,
  startFocus,
} from "@/lib/focusMode";

/**
 * Header button + popover that lets the user:
 *   - Name what they're focusing on and start a session
 *   - Maintain their "commitment list" (sites/apps to avoid)
 *   - Configure Freedom / iOS Shortcut deep-link URLs once
 */
export function FocusModeStarter() {
  const { toast } = useToast();
  const state = useFocusMode();
  const [taskDraft, setTaskDraft] = useState("");
  const [commitDraft, setCommitDraft] = useState("");
  const [freedomDraft, setFreedomDraft] = useState(state.freedomUrl);
  const [shortcutDraft, setShortcutDraft] = useState(state.iosShortcutName);

  // Hide the starter when a focus session is already running — the banner
  // shows controls in that mode.
  if (state.active) return null;

  const addCommitment = () => {
    const v = commitDraft.trim();
    if (!v) return;
    if (state.commitments.map((c) => c.toLowerCase()).includes(v.toLowerCase())) {
      setCommitDraft("");
      return;
    }
    patchFocusState({ commitments: [...state.commitments, v] });
    setCommitDraft("");
  };

  const removeCommitment = (c: string) => {
    patchFocusState({
      commitments: state.commitments.filter((x) => x !== c),
    });
  };

  const saveDeepLinks = () => {
    patchFocusState({
      freedomUrl: freedomDraft.trim() || "freedom://start",
      iosShortcutName: shortcutDraft.trim(),
    });
    toast({ title: "Saved", description: "Deep-link settings updated." });
  };

  const handleStart = () => {
    startFocus({ taskTitle: taskDraft });
    setTaskDraft("");
    toast({
      title: "Focus on, sir.",
      description: taskDraft.trim()
        ? `Aimed at: ${taskDraft.trim()}`
        : "Distractions dimmed.",
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 px-3 py-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-gold hover:bg-muted/40 transition-colors"
          aria-label="Start focus mode"
        >
          <Focus className="h-3.5 w-3.5" />
          Focus
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-96 bg-popover border-border max-h-[80vh] overflow-y-auto"
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-display text-lg">Begin focus, sir.</h4>
            <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground mt-0.5">
              Honor-system blocking
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">
              What are you focusing on?
            </label>
            <Input
              value={taskDraft}
              onChange={(e) => setTaskDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleStart();
              }}
              placeholder="e.g. finish cover letter"
              className="h-9 text-sm bg-background/50 border-border"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">
                Commitments — sites/apps to avoid
              </label>
              <span className="font-mono text-[9px] text-muted-foreground/70">
                {state.commitments.length} item
                {state.commitments.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 items-center">
              {state.commitments.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gold/30 bg-gold/10 text-gold text-[10px] font-mono tracking-[0.1em]"
                >
                  {c}
                  <button
                    type="button"
                    onClick={() => removeCommitment(c)}
                    className="text-gold/70 hover:text-destructive"
                    aria-label={`Remove ${c}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <Input
                value={commitDraft}
                onChange={(e) => setCommitDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addCommitment();
                  }
                }}
                onBlur={addCommitment}
                placeholder="add…"
                className="h-7 px-2 text-[11px] bg-background/50 border-border w-24"
              />
            </div>
            <p className="font-mono text-[9px] text-muted-foreground/70 leading-snug">
              Alfred can't block these technically — but he'll show the list
              prominently so you remember what you said.
            </p>
          </div>

          <div className="rounded-md border border-border/60 p-3 space-y-2">
            <div className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">
              Optional: launch a real blocker
            </div>
            <label className="block space-y-1">
              <span className="text-[10px] text-muted-foreground">
                Freedom URL scheme
              </span>
              <Input
                value={freedomDraft}
                onChange={(e) => setFreedomDraft(e.target.value)}
                placeholder="freedom://start"
                className="h-7 px-2 text-[11px] bg-background/50 border-border"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] text-muted-foreground">
                iOS Shortcut name (your Focus shortcut)
              </span>
              <Input
                value={shortcutDraft}
                onChange={(e) => setShortcutDraft(e.target.value)}
                placeholder="e.g. Deep Work"
                className="h-7 px-2 text-[11px] bg-background/50 border-border"
              />
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={saveDeepLinks}
              className="border-border text-muted-foreground hover:text-gold w-full"
            >
              Save deep-links
            </Button>
            <p className="font-mono text-[9px] text-muted-foreground/70 leading-snug">
              Once saved, the focus banner shows one-tap buttons to launch them.
            </p>
          </div>

          <Button
            type="button"
            onClick={handleStart}
            className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90"
          >
            <Focus className="h-4 w-4 mr-1.5" />
            Begin focus session
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function LaunchDeepLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 font-mono text-[10px] tracking-[0.15em] uppercase text-muted-foreground hover:text-gold hover:border-gold/40 transition-colors"
    >
      {label}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

export { iosShortcutUrl };
