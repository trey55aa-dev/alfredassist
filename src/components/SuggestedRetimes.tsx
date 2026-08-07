import { useState } from "react";
import { Clock3, Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  loadCompletions,
  loadCompletionTimes,
  loadTemplates,
  upsertTemplate,
} from "@/lib/recurring";
import { suggestRetimes, type RetimeSuggestion } from "@/lib/recurringSuggest";
import { recordDecision, wasDismissed } from "@/lib/alfredAdapt";
import { useRecurringSync } from "@/hooks/useRecurringSync";
import { useAuth } from "@/hooks/useAuth";

/** Declined retimes stay off the table for two weeks — long enough for the
 *  pattern that triggered it to actually change before Alfred asks again. */
const DISMISS_WINDOW_MS = 14 * 24 * 3600_000;

function fmt(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SuggestedRetimes({ now, onChanged }: { now: Date; onChanged: () => void }) {
  const { user } = useAuth();
  const { pushTemplateOp } = useRecurringSync(user?.id);
  // Computed once on mount (lazy initializer) — recomputing every time `now`
  // ticks (every minute, from the Agenda clock) would be wasted work and
  // would resurrect suggestions the user just dismissed this session.
  const [suggestions, setSuggestions] = useState<RetimeSuggestion[]>(() => {
    const all = suggestRetimes(loadTemplates(), loadCompletions(), loadCompletionTimes(), now);
    return all.filter((s) => !wasDismissed("block-retime", s.dedupeKey, DISMISS_WINDOW_MS));
  });

  if (suggestions.length === 0) return null;

  const label = (s: RetimeSuggestion) =>
    `${s.title} → ${fmt(s.suggestedStart)}`;

  const accept = (s: RetimeSuggestion) => {
    const template = loadTemplates().find((t) => t.id === s.templateId);
    if (!template) return;
    const updated = {
      ...template,
      startTime: s.suggestedStart,
      endTime: s.suggestedEnd,
    };
    upsertTemplate(updated);
    pushTemplateOp(updated);
    recordDecision({
      source: "block-retime",
      key: s.dedupeKey,
      action: "accepted",
      label: label(s),
    });
    setSuggestions((prev) => prev?.filter((x) => x !== s) ?? null);
    onChanged();
  };

  const dismiss = (s: RetimeSuggestion) => {
    recordDecision({
      source: "block-retime",
      key: s.dedupeKey,
      action: "dismissed",
      label: label(s),
    });
    setSuggestions((prev) => prev?.filter((x) => x !== s) ?? null);
  };

  return (
    <Card className="p-5 sm:p-6 bg-gradient-card border-border">
      <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.28em] uppercase text-gold mb-3">
        <Clock3 className="h-3 w-3" /> Alfred noticed a pattern
      </p>
      <ul className="space-y-2">
        {suggestions.map((s) => (
          <li
            key={s.dedupeKey}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-background/40 border border-border/60"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm text-foreground truncate">{s.title}</div>
              <div className="font-mono text-[10px] text-muted-foreground/70 mt-0.5">
                Actually done ~{Math.abs(s.avgOffsetMinutes)} min{" "}
                {s.avgOffsetMinutes > 0 ? "after" : "before"} {fmt(s.currentStart)}, {s.sampleSize}{" "}
                of the last few days. Move it to {fmt(s.suggestedStart)}?
              </div>
            </div>
            <button
              onClick={() => accept(s)}
              title={`Retime to ${fmt(s.suggestedStart)}`}
              className="shrink-0 h-8 w-8 rounded-lg border border-teal/40 bg-teal/10 text-teal hover:bg-teal/25 active:scale-95 transition-all flex items-center justify-center"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => dismiss(s)}
              title="Keep current time"
              className="shrink-0 h-8 w-8 rounded-lg text-muted-foreground/50 hover:text-foreground transition-colors flex items-center justify-center"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
