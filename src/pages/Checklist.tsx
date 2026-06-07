import { useMemo, useState } from "react";
import { awardXp, XP_VALUES } from "@/lib/gamification";
import { Plus, Trash2, Flame, Target as TargetIcon, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
  buildRecovery,
  currentStreakFor,
  habitsAtRisk,
  isCompleteForPeriod,
  last7Periods,
  longestStreakFor,
  toggleHabitForToday,
} from "@/lib/habits";
import type { Goal } from "@/lib/goals";
import { useCloudHabits } from "@/hooks/useCloudHabits";
import { useCloudGoals } from "@/hooks/useCloudGoals";
import { RecoveryPanel } from "@/components/RecoveryPanel";
import { useEffect } from "react";

// Legacy export kept so Dashboard's existing import doesn't break
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

  const activeHabits = useMemo(() => habits.filter((h) => !h.archived), [habits]);

  const grouped = useMemo(() => {
    const out: Record<Cadence, Habit[]> = {
      daily: [],
      weekly: [],
      monthly: [],
      quarterly: [],
      annual: [],
    };
    for (const h of activeHabits) out[h.cadence].push(h);
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
    const wasDone = isCompleteForPeriod(habit, logs);
    const { logs: nextLogs, nowComplete } = toggleHabitForToday(habit, logs);
    setLogs(nextLogs);
    if (nowComplete && !wasDone) {
      const streakDays = currentStreakFor(habit, nextLogs);
      awardXp(XP_VALUES.HABIT_COMPLETE, "habit", { streakDays });
    }

    // Auto-increment linked goal
    if (habit.goalId && nowComplete && !wasDone) {
      const inc = habit.goalIncrement ?? 1;
      setGoals(
        goals.map((g) =>
          g.id === habit.goalId
            ? {
                ...g,
                current:
                  typeof g.target === "number"
                    ? Math.min(g.target, (g.current ?? 0) + inc)
                    : (g.current ?? 0) + inc,
              }
            : g
        )
      );
    } else if (habit.goalId && !nowComplete && wasDone) {
      const inc = habit.goalIncrement ?? 1;
      setGoals(
        goals.map((g) =>
          g.id === habit.goalId
            ? { ...g, current: Math.max(0, (g.current ?? 0) - inc) }
            : g
        )
      );
    }
  };

  const handleRecover = (habitId: string) => {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;
    if (!isCompleteForPeriod(habit, logs)) handleToggle(habit);
  };

  const addHabit = (h: Omit<Habit, "id" | "createdAt">) => {
    setHabits([...habits, { ...h, id: crypto.randomUUID(), createdAt: Date.now() }]);
  };

  const updateHabit = (id: string, patch: Partial<Habit>) =>
    setHabits(habits.map((h) => (h.id === id ? { ...h, ...patch } : h)));

  const deleteHabit = (id: string) => {
    setHabits(habits.filter((h) => h.id !== id));
    setLogs(logs.filter((l) => l.habitId !== id));
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Daily protocol"
        title="The Checklist"
        description="Habits with cadence and streaks. Tick the period as you complete it; your streak holds as long as you do."
      />

      {/* Recovery */}
      <RecoveryPanel recoveries={recoveries} onMarkDone={handleRecover} />

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
              onToggle={handleToggle}
              onUpdate={updateHabit}
              onDelete={deleteHabit}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/* ---------- Cadence section ---------- */

function CadenceSection({
  cadence,
  habits,
  logs,
  goals,
  onToggle,
  onUpdate,
  onDelete,
}: {
  cadence: Cadence;
  habits: Habit[];
  logs: HabitLog[];
  goals: Goal[];
  onToggle: (h: Habit) => void;
  onUpdate: (id: string, patch: Partial<Habit>) => void;
  onDelete: (id: string) => void;
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
            onToggle={() => onToggle(h)}
            onUpdate={(p) => onUpdate(h.id, p)}
            onDelete={() => onDelete(h.id)}
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
  onToggle,
  onUpdate,
  onDelete,
}: {
  habit: Habit;
  logs: HabitLog[];
  goals: Goal[];
  onToggle: () => void;
  onUpdate: (patch: Partial<Habit>) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const done = isCompleteForPeriod(habit, logs);
  const streak = currentStreakFor(habit, logs);
  const longest = Math.max(longestStreakFor(habit, logs), streak);
  const week = last7Periods(habit, logs);
  const linkedGoal = goals.find((g) => g.id === habit.goalId);
  const recovery = !done ? buildRecovery(habit, logs) : null;

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
        <button onClick={() => setOpen((o) => !o)} className="flex-1 min-w-0 text-left">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span
              className={`text-sm ${
                done ? "line-through text-muted-foreground" : "text-foreground"
              }`}
            >
              {habit.title}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
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
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground/60 transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              />
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

      {open && (
        <div className="px-3 pb-3 space-y-3 fade-in border-t border-border/40 pt-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Current" value={streak} />
            <Stat label="Longest" value={longest} />
            <Stat
              label={CADENCE_NOUN[habit.cadence] + "s missed"}
              value={recovery ? recovery.missedPeriods : 0}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <SimpleSelect
              label="Cadence"
              value={habit.cadence}
              onChange={(v) => onUpdate({ cadence: v as Cadence })}
              options={CADENCES}
              render={(v) => CADENCE_LABEL[v as Cadence]}
            />
            <SimpleSelect
              label="Linked goal"
              value={habit.goalId ?? ""}
              onChange={(v) => onUpdate({ goalId: v || undefined })}
              options={["", ...goals.map((g) => g.id)]}
              render={(v) =>
                v === "" ? "None" : goals.find((g) => g.id === v)?.title ?? "—"
              }
            />
          </div>

          <div>
            <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Custom recovery steps (one per line)
            </label>
            <Textarea
              value={(habit.recoverySteps ?? []).join("\n")}
              onChange={(e) =>
                onUpdate({
                  recoverySteps: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder={`Leave blank to use Alfred's defaults…`}
              className="mt-1 bg-background/40 border-border text-xs min-h-[60px] resize-none focus-visible:ring-gold/40 focus-visible:border-gold/40"
            />
          </div>

          <div className="flex justify-between items-center pt-1">
            <button
              onClick={() => onUpdate({ archived: true })}
              className="text-[10px] tracking-[0.2em] uppercase font-mono text-muted-foreground hover:text-gold"
            >
              Archive
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete "${habit.title}" and all its history?`)) onDelete();
              }}
              className="text-muted-foreground/60 hover:text-destructive transition-colors"
              aria-label="Delete habit"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-background/40 border border-border/60 py-2">
      <div className="font-display text-2xl text-gold leading-none">{value}</div>
      <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground mt-1">
        {label}
      </div>
    </div>
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
