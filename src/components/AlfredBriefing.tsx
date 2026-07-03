import { useMemo, useState } from "react";
import { X, MessageCircle, Sparkles } from "lucide-react";
import { ButlerAvatar } from "./ButlerAvatar";
import {
  currentBriefingType,
  briefingSeen,
  markBriefingSeen,
  buildBriefing,
  hasBriefingData,
  type BriefingType,
  type Tone,
} from "@/lib/briefing";

const TONE: Record<Tone, string> = {
  gold: "text-gold",
  teal: "text-teal",
  coral: "text-coral",
  muted: "text-muted-foreground",
};

/** Proactive Alfred — a self-appearing morning briefing / evening review card. */
export function AlfredBriefing() {
  const [dismissed, setDismissed] = useState(false);
  const now = useMemo(() => new Date(), []);
  // ?briefing=morning|evening forces a variant (on-demand preview + testing),
  // bypassing the time-window, once-seen, and empty-account guards.
  const override = useMemo<BriefingType | null>(() => {
    if (typeof window === "undefined") return null;
    const q = new URLSearchParams(window.location.search).get("briefing");
    return q === "morning" || q === "evening" ? q : null;
  }, []);
  const type = override ?? currentBriefingType(now);
  const briefing = useMemo(() => (type ? buildBriefing(type, now) : null), [type, now]);

  if (!type || !briefing) return null;
  if (dismissed) return null;
  if (!override && (briefingSeen(type) || !hasBriefingData())) return null;

  const dismiss = () => {
    markBriefingSeen(type);
    setDismissed(true);
  };
  const askAlfred = () => {
    dismiss();
    window.dispatchEvent(new CustomEvent("alfred.butler:open"));
  };

  return (
    <div className="glass-card p-5 sm:p-6 relative overflow-hidden animate-scale-in">
      <button
        onClick={dismiss}
        aria-label="Dismiss briefing"
        className="absolute top-3 right-3 text-muted-foreground/40 hover:text-foreground transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex gap-4">
        <div className="shrink-0">
          <ButlerAvatar size={56} state="speaking" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="inline-flex items-center gap-1 font-mono text-[9px] tracking-[0.28em] uppercase text-gold mb-1">
            <Sparkles className="h-3 w-3" />
            {type === "morning" ? "Morning briefing" : "Evening review"}
          </span>
          <p className="font-display text-lg text-foreground/80">{briefing.greeting}</p>
          <p className={`font-display text-xl sm:text-2xl leading-snug mt-0.5 ${TONE[briefing.headlineTone]}`}>
            {briefing.headline}
          </p>

          {briefing.items.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {briefing.items.map((it, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span aria-hidden className="shrink-0">{it.icon}</span>
                  <span className={TONE[it.tone]}>{it.text}</span>
                </li>
              ))}
            </ul>
          )}

          <p className="font-display italic text-sm text-muted-foreground/80 mt-3">
            {briefing.closer}
          </p>

          <div className="flex gap-2 mt-4">
            <button
              onClick={askAlfred}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gold/15 border border-gold/30 text-gold px-3 py-1.5 text-[11px] font-mono tracking-wider uppercase hover:bg-gold/25 transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Ask Alfred
            </button>
            <button
              onClick={dismiss}
              className="rounded-xl px-3 py-1.5 text-[11px] font-mono tracking-wider uppercase text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
