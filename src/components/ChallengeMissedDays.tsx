// "I did that day, I just didn't tick it" — review the challenge's slipped days
// and put the record straight, without letting the record become fiction.
//
// Every retroactive tick is logged in the backfill ledger and surfaced back to
// the user as a count, so an adherence number always carries how it was built.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronUp, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { todayKey } from "@/lib/alfred";
import type { Habit, HabitLog } from "@/lib/habits";
import { loadCompletions, loadTemplates, RECURRING_CHANGED } from "@/lib/recurring";
import {
  challengeDays,
  challengeHabits,
  challengeSlippedDays,
  useChallenge,
  type ChallengeDay,
} from "@/lib/challenge";
import {
  canEditDate,
  clearBackfill,
  countBackfillsInRange,
  isBackfilled,
  loadBackfills,
  markBackfilled,
} from "@/lib/habitBackfill";

interface Props {
  habits: Habit[];
  habitLogs: HabitLog[];
  setHabitLogs: (next: HabitLog[]) => void;
}

function friendly(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function ChallengeMissedDays({ habits, habitLogs, setHabitLogs }: Props) {
  const cfg = useChallenge();
  const [open, setOpen] = useState(false);
  // Bumped on every edit so the ledger is re-read without a page reload.
  const [ledgerTick, setLedgerTick] = useState(0);

  // Recurring templates/completions live in plain localStorage, not a hook —
  // re-read on the same change event the rest of the app listens for.
  const [recurringTick, setRecurringTick] = useState(0);
  useEffect(() => {
    const onChange = () => setRecurringTick((n) => n + 1);
    window.addEventListener(RECURRING_CHANGED, onChange);
    return () => window.removeEventListener(RECURRING_CHANGED, onChange);
  }, []);

  const today = todayKey();
  const tracked = useMemo(() => challengeHabits(cfg, habits), [cfg, habits]);
  const days = useMemo(
    () => challengeDays(cfg, habits, habitLogs, loadTemplates(), loadCompletions()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cfg, habits, habitLogs, recurringTick],
  );
  const slipped = useMemo(() => challengeSlippedDays(days), [days]);
  const ledger = useMemo(() => loadBackfills(), [ledgerTick, habitLogs]);

  const editable = slipped.filter((d) => canEditDate(d.date, cfg.startDate, today));
  const lastDay = days[days.length - 1]?.date ?? cfg.startDate;
  const addedLater = countBackfillsInRange(ledger, cfg.startDate, lastDay);

  if (tracked.length === 0) return null;

  const missingHabitsFor = (day: ChallengeDay): Habit[] =>
    tracked.filter((h) => !habitLogs.some((l) => l.habitId === h.id && l.date === day.date));

  const markHabitDone = (habit: Habit, date: string) => {
    if (!canEditDate(date, cfg.startDate, today)) return;
    if (habitLogs.some((l) => l.habitId === habit.id && l.date === date)) return;
    setHabitLogs([...habitLogs, { habitId: habit.id, date }]);
    markBackfilled(habit.id, date);
    setLedgerTick((n) => n + 1);
  };

  const undoHabit = (habit: Habit, date: string) => {
    setHabitLogs(habitLogs.filter((l) => !(l.habitId === habit.id && l.date === date)));
    clearBackfill(habit.id, date);
    setLedgerTick((n) => n + 1);
  };

  return (
    <div className="rounded-xl border border-border/60 bg-background/30 p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div>
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
            Days you missed
          </div>
          <div className="text-sm text-foreground mt-0.5">
            {editable.length === 0
              ? "Nothing outstanding — every past day is accounted for."
              : `${editable.length} day${editable.length === 1 ? "" : "s"} short of the routine`}
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* The check measure: adherence always carries how it was built. */}
      {addedLater > 0 && (
        <div className="mt-2 flex items-start gap-1.5 rounded-md border border-gold/25 bg-gold/5 px-2.5 py-1.5">
          <AlertTriangle className="h-3 w-3 text-gold mt-0.5 shrink-0" />
          <div className="font-mono text-[10px] leading-relaxed text-muted-foreground">
            {addedLater} tick{addedLater === 1 ? "" : "s"} in this challenge{" "}
            {addedLater === 1 ? "was" : "were"} added after the day itself. Your
            adherence figure includes {addedLater === 1 ? "it" : "them"}.
          </div>
        </div>
      )}

      {open && (
        <div className="mt-3 space-y-2 fade-in">
          {editable.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              Only days that have fully passed can be edited — today is still yours to finish.
            </p>
          )}

          {editable.map((day) => {
            const missing = missingHabitsFor(day);
            return (
              <div
                key={day.date}
                className="rounded-md border border-border/50 bg-background/40 p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-foreground">
                    Day {day.dayNumber} · {friendly(day.date)}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground shrink-0">
                    {day.completed}/{day.applicable} done
                  </span>
                </div>

                <div className="mt-2 space-y-1">
                  {missing.map((h) => (
                    <div key={h.id} className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground truncate">{h.title}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markHabitDone(h, day.date)}
                        className="h-6 shrink-0 border-teal/40 px-2 text-[10px] text-teal hover:bg-teal/10"
                      >
                        <Check className="mr-1 h-3 w-3" />I did this
                      </Button>
                    </div>
                  ))}

                  {/* Anything already put right stays undoable. */}
                  {tracked
                    .filter(
                      (h) =>
                        isBackfilled(ledger, h.id, day.date) &&
                        habitLogs.some((l) => l.habitId === h.id && l.date === day.date),
                    )
                    .map((h) => (
                      <div key={h.id} className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-teal truncate">
                          {h.title} · added later
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => undoHabit(h, day.date)}
                          className="h-6 shrink-0 px-2 text-[10px] text-muted-foreground"
                        >
                          <Undo2 className="mr-1 h-3 w-3" />
                          Undo
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
