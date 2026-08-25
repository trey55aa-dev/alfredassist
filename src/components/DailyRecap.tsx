import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, ClipboardCopy, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  buildRecapItems,
  formatRecapText,
  groupRecapItems,
  type RecapItem,
  type RecapStyle,
} from "@/lib/dailyRecap";
import {
  getEntry,
  loadTargetLog,
  loadTargets,
  setEntry,
  GOAL_TARGETS_CHANGED,
  type GoalDailyTarget,
} from "@/lib/goalTargets";
import { getDailyFeedback, setDailyFeedback } from "@/lib/dailyFeedback";
import { todayKey, formatLongDate } from "@/lib/alfred";
import type { AgendaEvent } from "@/lib/agenda";
import type { Habit, HabitLog } from "@/lib/habits";
import { loadHabitTimes } from "@/lib/habits";

const COPY_OPTIONS: { style: RecapStyle; label: string }[] = [
  { style: "checklist", label: "Copy today's checklist" },
  { style: "accomplished", label: "Copy what I accomplished" },
  { style: "withNote", label: "Copy checklist + note" },
];

function fmtTime(ms?: number): string {
  if (ms === undefined) return "";
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function DailyRecap({
  events,
  habits,
  habitLogs,
  now,
  onToggleEvent,
  onToggleHabit,
}: {
  events: AgendaEvent[];
  habits: Habit[];
  habitLogs: HabitLog[];
  now: Date;
  /** Cross an event off from the recap itself. */
  onToggleEvent?: (id: string) => void;
  /** Cross a habit off from the recap itself. */
  onToggleHabit?: (id: string) => void;
}) {
  const dateStr = todayKey(now);
  const [feedback, setFeedback] = useState(() => getDailyFeedback(dateStr));
  // Sub-goals live in plain localStorage; re-read on their change event so a
  // tick here and a tick on the dashboard stay in step.
  const [targetTick, setTargetTick] = useState(0);
  useEffect(() => {
    const onChange = () => setTargetTick((n) => n + 1);
    window.addEventListener(GOAL_TARGETS_CHANGED, onChange);
    return () => window.removeEventListener(GOAL_TARGETS_CHANGED, onChange);
  }, []);

  const targets = useMemo<GoalDailyTarget[]>(() => loadTargets(), [targetTick]);
  const targetLog = useMemo(() => loadTargetLog(), [targetTick]);

  const items = buildRecapItems(
    events,
    habits,
    habitLogs,
    loadHabitTimes(),
    now,
    targets,
    targetLog,
  );
  const doneCount = items.filter((i) => i.done).length;
  const groups = groupRecapItems(items);

  /** A "log" sub-goal is answered by a number, so it can't be ticked here. */
  const toggleTarget = (item: RecapItem) => {
    const target = targets.find((t) => t.id === item.id);
    if (!target || target.kind === "log") return;
    const existing = getEntry(targetLog, target.id, dateStr);
    setEntry(target.id, existing?.done ? null : { ...existing, done: true }, dateStr);
    setTargetTick((n) => n + 1);
  };

  const toggle = (item: RecapItem) => {
    if (item.kind === "event") onToggleEvent?.(item.id);
    else if (item.kind === "habit") onToggleHabit?.(item.id);
    else toggleTarget(item);
  };

  const canToggle = (item: RecapItem): boolean => {
    if (item.kind === "event") return !!onToggleEvent;
    if (item.kind === "habit") return !!onToggleHabit;
    return targets.find((t) => t.id === item.id)?.kind !== "log";
  };

  const handleFeedbackChange = (text: string) => {
    setFeedback(text);
    setDailyFeedback(dateStr, text);
  };

  const copy = async (style: RecapStyle) => {
    const text = formatRecapText(items, style, formatLongDate(now), feedback);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied — paste into Notes, Reminders, or a calendar event");
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };

  if (items.length === 0) return null;

  return (
    <Card className="p-5 sm:p-6 bg-gradient-card border-border">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <p className="font-mono text-[10px] tracking-[0.28em] uppercase text-muted-foreground mb-1">
            Today's recap
          </p>
          <h3 className="font-display text-2xl">
            {doneCount}/{items.length} crossed off
          </h3>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-[11px] font-mono tracking-wider uppercase text-gold hover:bg-gold/20 transition-colors">
              <ClipboardCopy className="h-3.5 w-3.5" />
              Copy
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {COPY_OPTIONS.map((o) => (
              <DropdownMenuItem key={o.style} onClick={() => copy(o.style)}>
                {o.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.group}>
            <p className="font-mono text-[9px] tracking-[0.25em] uppercase text-muted-foreground/70 mb-1.5">
              {g.label} · {g.items.filter((i) => i.done).length}/{g.items.length}
            </p>
            <ul className="space-y-1.5">
              {g.items.map((i) => {
                const interactive = canToggle(i);
                const row = (
                  <>
                    {i.done ? (
                      <CheckCircle2 className="h-4 w-4 text-teal shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    )}
                    <span
                      className={
                        i.done ? "text-muted-foreground line-through" : "text-foreground"
                      }
                    >
                      {i.title}
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground/60 whitespace-nowrap">
                      {i.done
                        ? fmtTime(i.actualMs)
                        : i.scheduledMs
                          ? fmtTime(i.scheduledMs)
                          : ""}
                    </span>
                  </>
                );
                return (
                  <li key={`${i.kind}:${i.id}`} className="text-sm">
                    {interactive ? (
                      <button
                        type="button"
                        onClick={() => toggle(i)}
                        aria-pressed={i.done}
                        className="flex w-full items-center gap-2.5 rounded-md px-1 py-0.5 -mx-1 text-left hover:bg-background/40 transition-colors"
                      >
                        {row}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2.5 px-1 py-0.5">{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-border/40">
        <label className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/70 mb-1.5 block">
          How did today actually go?
        </label>
        <Textarea
          value={feedback}
          onChange={(e) => handleFeedbackChange(e.target.value)}
          placeholder="Optional — a quick note for yourself (or for Alfred to learn from)"
          className="bg-background/40 border-border text-sm min-h-[60px]"
        />
      </div>
    </Card>
  );
}
