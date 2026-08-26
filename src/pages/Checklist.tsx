import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { awardXp, makeUpMissedDay, XP_VALUES } from "@/lib/gamification";
import { toast } from "sonner";
import { Plus, Flame, Target as TargetIcon, ChevronRight, ArrowRight, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { todayKey } from "@/lib/alfred";
import {
  STREAK_KEY,
  StreakState,
  emptyStreak,
  reconcileToday,
} from "@/lib/streak";
import {
  Cadence,
  CADENCES,
  CADENCE_LABEL,
  CADENCE_NOUN,
  Habit,
  HabitLog,
  SEED_HABITS,
  currentStreakFor,
  habitsAtRisk,
  isCompleteForPeriod,
  last7Periods,
  normalizeCadence,
  toggleHabitForToday,
  recordHabitTime,
  removeHabitTime,
  purgeHabitMeta,
} from "@/lib/habits";
import { type Goal, progressPct } from "@/lib/goals";
import { logProgress } from "@/lib/goalsHistory";
import {
  isGoalDoneToday,
  setGoalDoneToday,
  goalsDoneTodayCount,
  dailyPaceAmount,
  paceHint,
  sortForDaily,
} from "@/lib/goalDaily";
import { useCloudHabits } from "@/hooks/useCloudHabits";
import { useCloudGoals } from "@/hooks/useCloudGoals";
import { useUiMode } from "@/lib/uiMode";
import { useChallenge, challengeHabits } from "@/lib/challenge";
import { applyHabitToggle } from "@/lib/habitToggle";
import { RecoveryPanel } from "@/components/RecoveryPanel";
import { HabitDetailSheet } from "@/components/HabitDetailSheet";
import { HabitRings } from "@/components/HabitRings";
import { HabitStepList } from "@/components/HabitStepList";
import { GoalEmoji } from "@/components/GoalEmoji";
import { ChallengeHeader } from "@/components/ChallengeHeader";
import { ChallengeMissedDays } from "@/components/ChallengeMissedDays";
import { GoalDailyTargets } from "@/components/GoalDailyTargets";

// Legacy export kept for any external importers.
export const DAILY = SEED_HABITS.filter((h) => h.cadence === "daily").map((h) => h.title);
export const DAILY_TOTAL = DAILY.length;

export interface ChecklistState {
  date: string;
  week?: string;
  daily: Record<string, boolean>;
  weekly: Record<string, boolean>;
}

export default function Checklist() {
  const { habits, setHabits, habitLogs: logs, setHabitLogs: setLogs } =
    useCloudHabits();
  const { goals, setGoals } = useCloudGoals();
  const [streak, setStreak] = useLocalStorage<StreakState>(STREAK_KEY, emptyStreak);
  const [tab, setTab] = useState<Cadence>("daily");
  const simple = useUiMode() === "simple";
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeHabits = useMemo(() => habits.filter((h) => !h.archived), [habits]);
  const challenge = useChallenge();
  // Only badge habits when the challenge is scoped to a goal — an unlinked
  // challenge covers every daily habit, so a badge on all of them is noise.
  const challengeHabitIds = useMemo(
    () =>
      challenge.goalId
        ? new Set(challengeHabits(challenge, activeHabits).map((h) => h.id))
        : new Set<string>(),
    [challenge, activeHabits],
  );
  const selected = useMemo(
    () => (selectedId ? habits.find((h) => h.id === selectedId) ?? null : null),
    [selectedId, habits],
  );

  const grouped = useMemo(() => {
    const out: Record<Cadence, Habit[]> = {
      daily: [], weekly: [], monthly: [], quarterly: [], annual: [],
    };
    for (const h of activeHabits) out[normalizeCadence(h.cadence)].push(h);
    return out;
  }, [activeHabits]);

  const recoveries = useMemo(() => habitsAtRisk(activeHabits, logs), [activeHabits, logs]);

  // Daily 100% protocol streak (preserves existing Dashboard streak card)
  const dailyHabits = grouped.daily;
  const dailyDone = useMemo(
    () => dailyHabits.filter((h) => isCompleteForPeriod(h, logs)).length,
    [dailyHabits, logs]
  );
  useEffect(() => {
    const isComplete = dailyHabits.length > 0 && dailyDone === dailyHabits.length;
    const next = reconcileToday(streak, isComplete);
    if (next !== streak) setStreak(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyDone, dailyHabits.length]);

  /* ----- mutations ----- */

  const handleToggle = (habit: Habit) => {
    const next = applyHabitToggle(habit, logs, goals);
    setLogs(next.logs);
    if (next.goals !== goals) setGoals(next.goals);
  };

  const handleRecover = (habitId: string) => {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;
    if (!isCompleteForPeriod(habit, logs)) handleToggle(habit);
  };

  // Edit history from the calendar: backfill a missed day or undo a stray tick.
  const handleToggleDate = (habit: Habit, dateYmd: string) => {
    // Editing *today* runs the full flow (streak, XP, linked-goal, completion time).
    if (dateYmd === todayKey()) {
      handleToggle(habit);
      return;
    }
    // A past day only adjusts the record — no retroactive XP or goal bumps,
    // BUT making up a day refunds exactly what that day's decay cost.
    const has = logs.some((l) => l.habitId === habit.id && l.date === dateYmd);
    if (has) {
      setLogs(logs.filter((l) => !(l.habitId === habit.id && l.date === dateYmd)));
      removeHabitTime(habit.id, dateYmd);
    } else {
      setLogs([...logs, { habitId: habit.id, date: dateYmd }]);
      const refund = makeUpMissedDay(dateYmd);
      if (refund) {
        toast.success(`Day made up — ${refund.delta} XP restored.`);
      }
    }
  };

  const addHabit = (h: Omit<Habit, "id" | "createdAt">) => {
    setHabits([...habits, { ...h, id: crypto.randomUUID(), createdAt: Date.now() }]);
  };

  const updateHabit = (id: string, patch: Partial<Habit>) =>
    setHabits(habits.map((h) => (h.id === id ? { ...h, ...patch } : h)));

  const deleteHabit = (id: string) => {
    setHabits(habits.filter((h) => h.id !== id));
    setLogs(logs.filter((l) => l.habitId !== id));
    purgeHabitMeta(id);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={simple ? "Every day" : "Daily protocol"}
        title={simple ? "Your habits" : "The Checklist"}
        description={
          simple
            ? "Check off what you do each day. Tap a habit to see your progress."
            : "Tap a habit to see its calendar and stats. Tick the period as you complete it; your streak holds as long as you do."
        }
      />

      <ChallengeHeader
        habits={activeHabits}
        habitLogs={logs}
        goals={goals}
        onToggleHabit={handleToggle}
      />

      {!simple && (
        <ChallengeMissedDays
          habits={activeHabits}
          habitLogs={logs}
          setHabitLogs={setLogs}
        />
      )}

      {/* Recovery */}
      <RecoveryPanel recoveries={recoveries} onMarkDone={handleRecover} />

      {/* Today at a glance — one ring per daily habit, tap to complete */}
      {dailyHabits.length > 0 && (
        <Card className="p-6 bg-gradient-card border-border">
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-4">
            Today
          </p>
          <HabitRings habits={dailyHabits} logs={logs} onToggle={handleToggle} />
        </Card>
      )}

      {/* Daily sub-goals — the concrete ask behind each 2026 goal */}
      <GoalDailyTargets goals={goals} setGoals={setGoals} />

      {/* Auto-generated daily to-dos from the 2026 goals */}
      <GoalDailyTasks goals={goals} setGoals={setGoals} />

      {/* Add habit */}
      <AddHabitForm goals={goals} onAdd={addHabit} defaultCadence={tab} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Cadence)}>
        <TabsList className="bg-muted/40 flex-wrap h-auto">
          {CADENCES.map((c) => (
            <TabsTrigger
              key={c}
              value={c}
              className="font-mono text-[11px] tracking-[0.2em] uppercase data-[state=active]:bg-gold data-[state=active]:text-primary-foreground"
            >
              {CADENCE_LABEL[c]}{" "}
              <span className="ml-1 text-[9px] opacity-60">{grouped[c].length}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {CADENCES.map((c) => (
          <TabsContent key={c} value={c} className="mt-6">
            <CadenceSection
              cadence={c}
              habits={grouped[c]}
              logs={logs}
              goals={goals}
              challengeHabitIds={challengeHabitIds}
              onToggle={handleToggle}
              onOpen={(h) => setSelectedId(h.id)}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* Detail sheet — calendar + stats + settings */}
      <HabitDetailSheet
        habit={selected}
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        logs={logs}
        goals={goals}
        onUpdate={updateHabit}
        onDelete={deleteHabit}
        onToggleDate={handleToggleDate}
      />
    </div>
  );
}

/* ---------- Daily goal to-dos (auto-generated from 2026 goals) ---------- */

function GoalDailyTasks({
  goals,
  setGoals,
}: {
  goals: Goal[];
  setGoals: (g: Goal[]) => void;
}) {
  const [, force] = useState(0); // re-render after toggling the local done store
  const today = todayKey();
  const active = useMemo(() => sortForDaily(goals.filter((g) => !g.done)), [goals]);

  if (active.length === 0) {
    return (
      <Card className="p-6 bg-gradient-card border-border text-center space-y-2">
        <TargetIcon className="h-7 w-7 text-muted-foreground/40 mx-auto" />
        <p className="font-display italic text-muted-foreground text-sm">
          No active goals yet. Set some and they'll appear here as daily to-dos.
        </p>
        <Link
          to="/goals-2026"
          className="inline-flex items-center gap-1 text-[10px] tracking-[0.2em] uppercase text-gold hover:text-gold-soft"
        >
          Open 2026 Goals <ArrowRight className="h-3 w-3" />
        </Link>
      </Card>
    );
  }

  const doneCount = goalsDoneTodayCount(active.map((g) => g.id), today);

  const toggle = (id: string) => {
    setGoalDoneToday(id, !isGoalDoneToday(id, today), today);
    force((n) => n + 1);
  };

  const quickLog = (goal: Goal, amt: number) => {
    setGoals(
      goals.map((g) =>
        g.id === goal.id ? { ...logProgress({ goal: g, delta: amt }), localUpdatedAt: Date.now() } : g,
      ),
    );
    setGoalDoneToday(goal.id, true, today);
    force((n) => n + 1);
  };

  return (
    <Card className="p-6 bg-gradient-card border-border">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.28em] uppercase text-gold mb-1">
            <Sparkles className="h-3 w-3" /> Today · from your 2026 goals
          </p>
          <h3 className="font-display text-2xl">Move every goal forward</h3>
        </div>
        <div className="text-right shrink-0">
          <div className="font-display text-3xl text-gold leading-none">
            {doneCount}
            <span className="text-muted-foreground/40 text-xl">/{active.length}</span>
          </div>
          <div className="font-mono text-[8px] tracking-widest uppercase text-muted-foreground mt-1">
            touched today
          </div>
        </div>
      </div>

      <ul className="space-y-2">
        {active.map((g) => {
          const done = isGoalDoneToday(g.id, today);
          const hint = paceHint(g);
          const amt = dailyPaceAmount(g);
          const measurable = typeof g.target === "number" && g.target > 0;
          const pct = progressPct(g);
          return (
            <li
              key={g.id}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-all ${
                done ? "bg-muted/40 border-border/40" : "bg-background/40 border-border/60 hover:border-gold/30"
              }`}
            >
              <Checkbox
                checked={done}
                onCheckedChange={() => toggle(g.id)}
                className="border-gold/40 data-[state=checked]:bg-gold data-[state=checked]:text-primary-foreground"
              />
              <GoalEmoji goal={g} className="text-lg shrink-0" />
              <Link to="/goals-2026" className="flex-1 min-w-0 group">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm ${done ? "line-through text-muted-foreground" : "text-foreground group-hover:text-gold transition-colors"}`}>
                    {g.title}
                  </span>
                  <span className="font-mono text-[8px] tracking-[0.15em] uppercase text-gold/60">{g.category}</span>
                </div>
                <div className={`font-mono text-[10px] mt-0.5 ${hint ? "text-muted-foreground" : "text-muted-foreground/45"}`}>
                  {hint ?? "make a move today"}
                </div>
                {measurable && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-muted/60 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-gold transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="font-mono text-[9px] text-muted-foreground/70">{pct}%</span>
                  </div>
                )}
              </Link>
              {amt != null ? (
                <button
                  type="button"
                  onClick={() => quickLog(g, amt)}
                  title={`Log ${g.unit === "$" ? `$${amt.toLocaleString()}` : `${amt} ${g.unit ?? ""}`} toward ${g.title}`}
                  className="shrink-0 h-8 px-2.5 rounded-lg border border-gold/30 bg-gold/10 text-gold hover:bg-gold/25 active:scale-95 transition-all font-mono text-[11px] font-semibold"
                >
                  +{g.unit === "$" ? `$${amt.toLocaleString()}` : amt}
                </button>
              ) : (
                <ArrowRight className="h-4 w-4 text-muted-foreground/30 shrink-0" />
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ---------- Cadence section ---------- */

function CadenceSection({
  cadence,
  habits,
  logs,
  goals,
  challengeHabitIds,
  onToggle,
  onOpen,
}: {
  cadence: Cadence;
  habits: Habit[];
  logs: HabitLog[];
  goals: Goal[];
  challengeHabitIds: Set<string>;
  onToggle: (h: Habit) => void;
  onOpen: (h: Habit) => void;
}) {
  if (habits.length === 0) {
    return (
      <Card className="p-10 bg-gradient-card border-border text-center">
        <p className="font-display italic text-muted-foreground">
          No {CADENCE_LABEL[cadence].toLowerCase()} habits yet. Add one above.
        </p>
      </Card>
    );
  }

  const done = habits.filter((h) => isCompleteForPeriod(h, logs)).length;

  return (
    <Card className="p-6 bg-gradient-card border-border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display text-2xl">{CADENCE_LABEL[cadence]} habits</h3>
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mt-0.5">
            {done}/{habits.length} this {CADENCE_NOUN[cadence]}
          </p>
        </div>
      </div>
      <ul className="space-y-2">
        {habits.map((h) => (
          <HabitRow
            key={h.id}
            habit={h}
            logs={logs}
            goals={goals}
            inChallenge={challengeHabitIds.has(h.id)}
            onToggle={() => onToggle(h)}
            onOpen={() => onOpen(h)}
          />
        ))}
      </ul>
    </Card>
  );
}

/* ---------- Habit row ---------- */

function HabitRow({
  habit,
  logs,
  goals,
  inChallenge,
  onToggle,
  onOpen,
}: {
  habit: Habit;
  logs: HabitLog[];
  goals: Goal[];
  inChallenge: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const done = isCompleteForPeriod(habit, logs);
  const streak = currentStreakFor(habit, logs);
  const week = last7Periods(habit, logs);
  const linkedGoal = goals.find((g) => g.id === habit.goalId);

  return (
    <li
      className={`rounded-md border transition-all ${
        done
          ? "bg-muted/40 border-border/40"
          : "bg-background/30 border-border/60 hover:border-gold/30"
      }`}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <Checkbox
          checked={done}
          onCheckedChange={onToggle}
          className="border-gold/40 data-[state=checked]:bg-gold data-[state=checked]:text-primary-foreground"
        />
        <button onClick={onOpen} className="flex-1 min-w-0 text-left group">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span
              className={`text-sm ${
                done ? "line-through text-muted-foreground" : "text-foreground"
              }`}
            >
              {habit.title}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              {inChallenge && (
                <span
                  title="Counts toward the active challenge"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-[0.15em] bg-coral/10 text-coral border-coral/30"
                >
                  <Flame className="h-2.5 w-2.5" />
                  Challenge
                </span>
              )}
              {linkedGoal && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-[0.15em] bg-gold/10 text-gold border-gold/30">
                  <TargetIcon className="h-2.5 w-2.5" />
                  {linkedGoal.category}
                </span>
              )}
              <span className="inline-flex items-center gap-1 font-mono text-[10px] tracking-wider text-gold">
                <Flame className="h-3 w-3" />
                {streak}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-gold transition-colors" />
            </div>
          </div>

          {/* 7-period strip */}
          <div className="mt-1.5 flex gap-1">
            {week.map((p) => (
              <div
                key={p.key}
                title={p.key}
                className={`h-1.5 flex-1 rounded-sm ${
                  p.done
                    ? "bg-gradient-gold"
                    : p.isCurrent
                      ? "bg-muted/60 ring-1 ring-gold/40"
                      : "bg-muted/40"
                }`}
              />
            ))}
          </div>
        </button>
      </div>

      {/* Routine steps live outside the open-detail button — they have their own
          taps and must not nest inside another button. */}
      <div className="px-3 pb-2.5 -mt-1">
        <HabitStepList habit={habit} habitDone={done} onHabitShouldToggle={onToggle} />
      </div>
    </li>
  );
}

/* ---------- Add form ---------- */

function AddHabitForm({
  goals,
  onAdd,
  defaultCadence,
}: {
  goals: Goal[];
  onAdd: (h: Omit<Habit, "id" | "createdAt">) => void;
  defaultCadence: Cadence;
}) {
  const [title, setTitle] = useState("");
  const [cadence, setCadence] = useState<Cadence>(defaultCadence);
  const [goalId, setGoalId] = useState("");

  // keep cadence in sync with active tab when user switches without typing
  useEffect(() => {
    if (!title) setCadence(defaultCadence);
  }, [defaultCadence, title]);

  const submit = () => {
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      cadence,
      goalId: goalId || undefined,
    });
    setTitle("");
    setGoalId("");
  };

  return (
    <Card className="p-4 bg-gradient-card border-border">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="A new habit…"
          className="bg-background/40 border-border focus-visible:ring-gold/40 focus-visible:border-gold/40"
        />
        <SimpleSelect
          value={cadence}
          onChange={(v) => setCadence(v as Cadence)}
          options={CADENCES}
          render={(v) => CADENCE_LABEL[v as Cadence]}
        />
        <SimpleSelect
          value={goalId}
          onChange={setGoalId}
          options={["", ...goals.map((g) => g.id)]}
          render={(v) =>
            v === "" ? "Link a goal (optional)" : goals.find((g) => g.id === v)?.title ?? "—"
          }
        />
        <Button onClick={submit} className="bg-gold text-primary-foreground hover:bg-gold-soft">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
    </Card>
  );
}

/* ---------- Tiny select ---------- */

function SimpleSelect({
  value,
  onChange,
  options,
  render,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  render?: (v: string) => string;
  label?: string;
}) {
  return (
    <div className="flex-1 min-w-0">
      {label && (
        <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-background/40 border border-border rounded-md px-2 py-2 text-xs font-mono uppercase tracking-wider text-foreground focus:outline-none focus:ring-2 focus:ring-gold/40"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {render ? render(o) : o || "—"}
          </option>
        ))}
      </select>
    </div>
  );
}
