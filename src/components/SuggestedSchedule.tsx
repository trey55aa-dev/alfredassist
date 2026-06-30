import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Check,
  X,
  RefreshCw,
  Download,
  CalendarPlus,
  Clock,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { useCloudGoals } from "@/hooks/useCloudGoals";
import { suggestSchedule, type SuggestedBlock } from "@/lib/scheduleSuggest";
import { addLocalEvent } from "@/lib/agendaStore";
import { isGoogleConnected, createGoogleEvent } from "@/lib/googleCalendar";
import { eventsToIcs, downloadIcs } from "@/lib/ics";
import type { AgendaEvent } from "@/lib/agenda";

function fmtRange(startIso: string, endIso: string): string {
  const f = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${f(new Date(startIso))} – ${f(new Date(endIso))}`;
}

export function SuggestedSchedule({
  events,
  now,
  onAdded,
}: {
  events: AgendaEvent[];
  now: Date;
  onAdded: () => void;
}) {
  const { goals } = useCloudGoals();
  const [blocks, setBlocks] = useState<SuggestedBlock[] | null>(null);
  const [busy, setBusy] = useState(false);
  const activeGoals = goals.filter((g) => !g.done);

  const generate = () => {
    const b = suggestSchedule(goals, events, { now, date: now });
    setBlocks(b);
    if (b.length === 0) {
      toast.message("No open slots today", {
        description: activeGoals.length === 0
          ? "Add a goal first and Alfred will plan around your day."
          : "Your day is full between 8am–9pm, or there's nothing left to schedule.",
      });
    }
  };

  const toEvent = (b: SuggestedBlock): AgendaEvent => ({
    id: `sugg-${b.goalId}-${b.start}`,
    title: b.title,
    start: b.start,
    end: b.end,
    source: "manual",
    emoji: b.emoji,
    calendarColor: b.calendarColor,
    calendarName: "From goals",
    description: b.description,
  });

  const pushGoogle = async (b: SuggestedBlock) => {
    if (!isGoogleConnected()) return;
    try {
      await createGoogleEvent({
        title: b.title,
        start: b.start,
        end: b.end,
        emoji: b.emoji,
        description: b.description,
      });
    } catch (err) {
      console.warn("[alfred] Google event create failed:", err);
    }
  };

  const accept = async (b: SuggestedBlock) => {
    addLocalEvent(toEvent(b));
    await pushGoogle(b);
    setBlocks((bs) => bs?.filter((x) => x !== b) ?? null);
    onAdded();
    toast.success("Added to your day");
  };

  const dismiss = (b: SuggestedBlock) =>
    setBlocks((bs) => bs?.filter((x) => x !== b) ?? null);

  const addAll = async () => {
    if (!blocks || blocks.length === 0) return;
    setBusy(true);
    const google = isGoogleConnected();
    for (const b of blocks) {
      addLocalEvent(toEvent(b));
      if (google) await pushGoogle(b);
    }
    setBusy(false);
    setBlocks([]);
    onAdded();
    toast.success(`${blocks.length} block${blocks.length === 1 ? "" : "s"} added to your day${google ? " + Google Calendar" : ""}`);
  };

  const exportIcs = () => {
    if (!blocks || blocks.length === 0) return;
    downloadIcs(
      `alfred-schedule-${now.toISOString().slice(0, 10)}.ics`,
      eventsToIcs(blocks),
    );
    toast.success("Downloaded .ics — open it to add to Apple Calendar");
  };

  return (
    <Card className="p-5 sm:p-6 bg-gradient-card border-border">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.28em] uppercase text-gold mb-1">
            <Sparkles className="h-3 w-3" /> Suggested schedule · from your goals
          </p>
          <h3 className="font-display text-2xl">Plan my day around my goals</h3>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Alfred fits focus blocks into the open gaps around your calendar.
          </p>
        </div>
        <button
          onClick={generate}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-[11px] font-mono tracking-wider uppercase text-gold hover:bg-gold/20 transition-colors"
        >
          {blocks === null ? <Sparkles className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {blocks === null ? "Suggest my day" : "Re-suggest"}
        </button>
      </div>

      {activeGoals.length === 0 && blocks === null && (
        <p className="text-sm text-muted-foreground/70">
          No active goals yet.{" "}
          <Link to="/goals-2026" className="text-gold hover:text-gold-soft">Set some goals →</Link>
        </p>
      )}

      {blocks && blocks.length > 0 && (
        <>
          <ul className="space-y-2">
            {blocks.map((b) => (
              <li
                key={`${b.goalId}-${b.start}`}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-background/40 border border-border/60"
              >
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center text-base shrink-0"
                  style={{ background: `${b.calendarColor.replace(")", " / 0.18)").replace("hsl(", "hsl(")}`, border: `1px solid ${b.calendarColor}` }}
                >
                  {b.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground truncate">{b.title}</div>
                  <div className="font-mono text-[10px] text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" /> {fmtRange(b.start, b.end)}
                  </div>
                </div>
                <button
                  onClick={() => accept(b)}
                  title="Add this block"
                  className="shrink-0 h-8 w-8 rounded-lg border border-teal/40 bg-teal/10 text-teal hover:bg-teal/25 active:scale-95 transition-all flex items-center justify-center"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => dismiss(b)}
                  title="Dismiss"
                  className="shrink-0 h-8 w-8 rounded-lg text-muted-foreground/50 hover:text-foreground transition-colors flex items-center justify-center"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={addAll}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gold text-primary-foreground px-3.5 py-2 text-xs font-mono tracking-wider uppercase font-semibold hover:bg-gold-soft active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />}
              Add all to my day
            </button>
            <button
              onClick={exportIcs}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 px-3.5 py-2 text-xs font-mono tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> Apple Calendar (.ics)
            </button>
          </div>
          {!isGoogleConnected() && (
            <p className="font-mono text-[9px] text-muted-foreground/50 mt-2">
              Connect Google Calendar above to also push blocks there automatically.
            </p>
          )}
        </>
      )}
    </Card>
  );
}
