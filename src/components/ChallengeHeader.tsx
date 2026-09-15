import { useEffect, useMemo, useState } from "react";
import { Flame, Pencil, Shuffle, Target as TargetIcon, Check, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  setChallenge,
  completeChallenge,
  reopenChallenge,
  useChallenge,
  challengeStatus,
  challengeHabits,
  computeAdherence,
  challengeTheme,
  CHALLENGE_THEMES,
  CHALLENGE_COLORS,
  type ChallengeConfig,
  type ChallengeStatus,
} from "@/lib/challenge";
import { currentStreakFor, isCompleteForPeriod, type Habit, type HabitLog } from "@/lib/habits";
import type { Goal } from "@/lib/goals";
import { getDailyFeedback, setDailyFeedback } from "@/lib/dailyFeedback";
import { todayKey } from "@/lib/alfred";
import { loadTemplates, loadCompletions, RECURRING_CHANGED } from "@/lib/recurring";
import { suggestRewards } from "@/lib/rewards";
import { awardXp, getGamification, XP_VALUES } from "@/lib/gamification";

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function stateLineFor(status: ChallengeStatus): string {
  switch (status.state) {
    case "upcoming":
      return `Starts in ${status.daysUntilStart} day${status.daysUntilStart === 1 ? "" : "s"}`;
    case "ended":
      return `All ${status.totalDays} days done`;
    case "complete":
      return "Challenge complete";
    default: {
      const left = status.totalDays - status.dayNumber;
      return `${left} day${left === 1 ? "" : "s"} to go`;
    }
  }
}

/**
 * Habits/habitLogs come in as props rather than a fresh useCloudHabits() call
 * here — every page that hosts this header already calls that hook once for
 * its own UI, and a second independent instance wouldn't share React state
 * with the first. Toggling a habit through the page's own controls would
 * persist to localStorage fine but silently fail to refresh this component
 * until a full reload. Pass the same habits/habitLogs the page already has.
 */
export function ChallengeHeader({
  habits,
  habitLogs,
  goals,
  onToggleHabit,
}: {
  habits: Habit[];
  habitLogs: HabitLog[];
  goals: Goal[];
  /** Tick a habit straight from the challenge card. Omit to render read-only. */
  onToggleHabit?: (habit: Habit) => void;
}) {
  const cfg = useChallenge();
  const theme = challengeTheme(cfg);
  const [draft, setDraft] = useState(cfg);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const status = challengeStatus(cfg);
  const [rewardIdea, setRewardIdea] = useState(() => suggestRewards(undefined, 1)[0] ?? "");

  const linkedGoal = goals.find((g) => g.id === cfg.goalId);
  const trackedHabits = useMemo(() => challengeHabits(cfg, habits), [cfg, habits]);
  const doneToday = useMemo(
    () => trackedHabits.filter((h) => isCompleteForPeriod(h, habitLogs)).length,
    [trackedHabits, habitLogs],
  );

  // Today's recap note. Same store the Agenda's recap card writes to, so this
  // is one note about the day rather than a second copy of it.
  const dateStr = todayKey();
  const [note, setNote] = useState(() => getDailyFeedback(dateStr));
  useEffect(() => setNote(getDailyFeedback(dateStr)), [dateStr]);
  const saveNote = (text: string) => {
    setNote(text);
    setDailyFeedback(dateStr, text);
  };

  // The one-time XP award rides on the user closing the challenge out, not on
  // a date passing. The earned-badges check keeps it one award per user, so
  // reopening and re-closing can't farm it.
  const confirmComplete = () => {
    completeChallenge();
    if (!getGamification().earnedBadges.includes("challenge_complete")) {
      awardXp(XP_VALUES.CHALLENGE_COMPLETE, "challenge", { challengeComplete: true });
    }
  };

  // Recurring templates/completions live in plain localStorage, not a hook —
  // re-read on the same change event the rest of the app already listens for.
  const [recurringTick, setRecurringTick] = useState(0);
  useEffect(() => {
    const onChange = () => setRecurringTick((n) => n + 1);
    window.addEventListener(RECURRING_CHANGED, onChange);
    return () => window.removeEventListener(RECURRING_CHANGED, onChange);
  }, []);

  const adherence = useMemo(
    () => computeAdherence(cfg, habits, habitLogs, loadTemplates(), loadCompletions()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cfg, habits, habitLogs, recurringTick],
  );

  const save = () => {
    setChallenge(draft);
    setOpen(false);
  };

  const stateLine = stateLineFor(status);

  return (
    <div
      className="relative overflow-hidden rounded-3xl border p-6 sm:p-7"
      style={{
        borderColor: theme.border,
        background: theme.background,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{ background: theme.glow }}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.3em] uppercase text-amber-200/80 mb-2">
            <Flame className="h-3 w-3" /> Challenge
          </p>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl sm:text-3xl text-white leading-tight truncate">
              {cfg.title}
            </h2>
            <Popover
              open={open}
              onOpenChange={(o) => {
                setOpen(o);
                if (o) setDraft(cfg);
              }}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title="Edit challenge"
                  className="shrink-0 text-white/50 hover:text-white transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 bg-popover border-border" align="start">
                <div className="space-y-3">
                  <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                    Edit challenge
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/70">
                      Name
                    </label>
                    <Input
                      value={draft.title}
                      onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                      className="bg-background/60 border-border text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/70">
                      Start date
                    </label>
                    <Input
                      type="date"
                      value={draft.startDate}
                      onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
                      className="bg-background/60 border-border text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/70">
                      Length (days)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={draft.totalDays}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, totalDays: Math.max(1, Number(e.target.value) || 1) }))
                      }
                      className="bg-background/60 border-border text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/70">
                      Link to a 2026 goal (optional)
                    </label>
                    <select
                      value={draft.goalId ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, goalId: e.target.value || undefined }))
                      }
                      className="w-full bg-background/60 border border-border rounded-md px-2 py-2 text-xs font-mono uppercase tracking-wider text-foreground focus:outline-none focus:ring-2 focus:ring-gold/40"
                    >
                      <option value="">No goal — track full routine</option>
                      {goals.map((g) => (
                        <option key={g.id} value={g.id}>{g.title}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-muted-foreground/60 leading-snug">
                      Linked, this challenge only tracks daily habits that feed that goal —
                      not your whole routine.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/70">
                      Color
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {CHALLENGE_COLORS.map((c) => {
                        const selected = (draft.color ?? "ember") === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            title={CHALLENGE_THEMES[c].label}
                            aria-label={CHALLENGE_THEMES[c].label}
                            aria-pressed={selected}
                            onClick={() => setDraft((d) => ({ ...d, color: c }))}
                            className={`h-7 w-7 rounded-full border transition-all ${
                              selected
                                ? "ring-2 ring-offset-2 ring-offset-popover ring-foreground/70 border-transparent"
                                : "border-border/60 hover:scale-105"
                            }`}
                            style={{ background: CHALLENGE_THEMES[c].swatch }}
                          >
                            {selected && (
                              <Check className="h-3.5 w-3.5 text-white mx-auto drop-shadow" strokeWidth={3} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Button onClick={save} size="sm" className="w-full">
                    Save
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <p className="text-sm text-white/70 mt-1">
            {fmtDate(cfg.startDate)} – {fmtDate(addDays(cfg.startDate, cfg.totalDays - 1))} · {stateLine}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-white/55 mt-1">
            {linkedGoal ? (
              trackedHabits.length > 0 ? (
                <>
                  <TargetIcon className="h-3 w-3 shrink-0" />
                  Tracking {trackedHabits.length} habit{trackedHabits.length === 1 ? "" : "s"} for{" "}
                  <span className="text-white/80">{linkedGoal.title}</span>
                </>
              ) : (
                <>
                  <TargetIcon className="h-3 w-3 shrink-0" />
                  No daily habits feed{" "}
                  <span className="text-white/80">{linkedGoal.title}</span> yet — add one below and
                  link it to this goal.
                </>
              )
            ) : (
              <>Tracking your full daily routine — link a goal to narrow this down.</>
            )}
          </p>
        </div>

        <div className="text-right shrink-0">
          <div className="font-display text-4xl sm:text-5xl text-white leading-none">
            {status.dayNumber}
            <span className="text-xl text-white/50"> / {status.totalDays}</span>
          </div>
          <p className="font-mono text-[9px] tracking-[0.25em] uppercase text-white/60 mt-1">Day</p>
        </div>
      </div>

      {/* Today's list — what this challenge actually asks of you right now. */}
      {status.state === "active" && trackedHabits.length > 0 && (
        <div className="relative mt-5">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            className="w-full flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-left hover:bg-white/10 transition-colors"
          >
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/75">
              Today · {doneToday}/{trackedHabits.length} done
            </span>
            <span className="flex items-center gap-1.5 shrink-0 font-mono text-[9px] uppercase tracking-wider text-white/55">
              {expanded ? "Hide" : "Show"}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </span>
          </button>

          {expanded && (
            <>
              <ul className="mt-2 space-y-1.5">
              {trackedHabits.map((h) => {
                const done = isCompleteForPeriod(h, habitLogs);
                const streak = currentStreakFor(h, habitLogs);
                const Row = onToggleHabit ? "button" : "div";
                return (
                  <li key={h.id}>
                    <Row
                      {...(onToggleHabit
                        ? {
                            type: "button" as const,
                            onClick: () => onToggleHabit(h),
                            "aria-pressed": done,
                            title: done ? `Undo "${h.title}" for today` : `Mark "${h.title}" done`,
                          }
                        : {})}
                      className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                        done
                          ? "border-white/10 bg-white/5"
                          : "border-white/15 bg-white/[0.07]"
                      } ${onToggleHabit ? "hover:bg-white/15 active:scale-[0.99]" : ""}`}
                    >
                      <span
                        className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                          done ? "bg-white border-white" : "border-white/40"
                        }`}
                      >
                        {done && <Check className="h-3 w-3 text-black/80" strokeWidth={3} />}
                      </span>
                      <span
                        className={`flex-1 min-w-0 text-sm truncate ${
                          done ? "line-through text-white/45" : "text-white/90"
                        }`}
                      >
                        {h.title}
                      </span>
                      {streak > 0 && (
                        <span
                          title={`${streak}-day streak`}
                          className="shrink-0 font-mono text-[10px] text-amber-200/80"
                        >
                          🔥 {streak}
                        </span>
                      )}
                    </Row>
                  </li>
                );
              })}
              </ul>

              <div className="mt-3">
                <label
                  htmlFor="challenge-recap-note"
                  className="font-mono text-[9px] tracking-wider uppercase text-white/55 mb-1.5 block"
                >
                  How did today go?
                </label>
                <textarea
                  id="challenge-recap-note"
                  value={note}
                  onChange={(e) => saveNote(e.target.value)}
                  rows={2}
                  placeholder="Optional — a note for yourself, saved as you type"
                  className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white/90 placeholder:text-white/35 outline-none transition-colors focus:border-white/35 resize-none"
                />
              </div>
            </>
          )}
        </div>
      )}

      {status.state !== "upcoming" && adherence.applicable > 0 && (
        <>
          <div className="relative mt-5 h-1.5 rounded-full bg-white/15 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.round(adherence.pct * 100)}%`,
                background: theme.bar,
              }}
            />
          </div>
          <p className="relative mt-2 font-mono text-[9px] tracking-[0.2em] uppercase text-white/60">
            {Math.round(adherence.pct * 100)}% of {linkedGoal ? "these habits" : "your routine"} actually
            done so far ({adherence.completed}/{adherence.applicable})
          </p>
        </>
      )}

      {status.state === "ended" && (
        <div className="relative mt-5 flex items-center justify-between gap-3 flex-wrap rounded-xl border border-white/20 bg-white/10 px-3.5 py-3">
          <p className="text-sm text-white/85 min-w-0">
            That's all {status.totalDays} days. Close it out whenever you're ready.
          </p>
          <Button
            onClick={confirmComplete}
            size="sm"
            className="shrink-0 bg-white text-black hover:bg-white/90"
          >
            <Check className="h-3.5 w-3.5 mr-1.5" strokeWidth={3} /> Mark complete
          </Button>
        </div>
      )}

      {status.state === "complete" && (
        <div className="relative mt-5 space-y-2 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5">
          {rewardIdea && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-white/85 min-w-0">
                You made it. Maybe: <span className="font-medium">{rewardIdea}</span>
              </p>
              <button
                type="button"
                onClick={() => setRewardIdea(suggestRewards(undefined, 1)[0] ?? "")}
                title="Show a different idea"
                className="shrink-0 inline-flex items-center gap-1 text-[9px] font-mono uppercase text-white/60 hover:text-white transition-colors"
              >
                <Shuffle className="h-3 w-3" /> Shuffle
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={reopenChallenge}
            className="font-mono text-[9px] uppercase tracking-wider text-white/45 hover:text-white/75 transition-colors"
          >
            Closed this by mistake? Reopen it
          </button>
        </div>
      )}
    </div>
  );
}
