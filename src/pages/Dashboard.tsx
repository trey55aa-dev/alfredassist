import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckSquare,
  Timer,
  Brain,
  Mic,
  ArrowRight,
  Flame,
  Target,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { greeting, todayKey } from "@/lib/alfred";
import { Goal, progressPct, daysUntil } from "@/lib/goals";
import {
  STREAK_KEY,
  StreakState,
  emptyStreak,
  currentStreak,
  longestStreak,
  last7Days,
  reconcileToday,
} from "@/lib/streak";
import type { BrainEntry } from "./BrainDump";
import type { JournalEntry } from "./Journal";
import { BackupRestore } from "@/components/BackupRestore";
import {
  Habit,
  HabitLog,
  habitsAtRisk,
  isCompleteForPeriod,
  toggleHabitForToday,
} from "@/lib/habits";
import { useCloudHabits } from "@/hooks/useCloudHabits";
import { useCloudGoals } from "@/hooks/useCloudGoals";
import { RecoveryPanel } from "@/components/RecoveryPanel";
import { TodayAgendaCard } from "@/components/TodayAgendaCard";
import { TodayNowNext } from "@/components/TodayNowNext";
import { HealthSummaryCard } from "@/components/HealthSummaryCard";
import { useAuth } from "@/hooks/useAuth";
import { computeProjection } from "@/lib/goalsHistory";

interface FocusStats { date: string; sessions: number; minutes: number; }

const SNAP_KEY = "alfred.goals.dailySnap";

/** Format a rate/value with units — mirrors the helper in Goals2026. */
function fmtGoalVal(n: number, unit: string | undefined): string {
  if (!isFinite(n) || n === 0) return "—";
  const isMonetary = unit === "$" || unit?.toLowerCase() === "usd";
  if (isMonetary) return `$${Math.round(n).toLocaleString()}`;
  const str = n >= 10 ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, "");
  return unit ? `${str} ${unit}` : str;
}

/** Today at a Glance — one row per measurable goal. */
function TodayGoalsCard({
  goals,
  onQuickLog,
}: {
  goals: Goal[];
  onQuickLog: (goalId: string, delta: number) => void;
}) {
  const today = todayKey();
  const measurable = goals.filter(
    (g) => !g.done && typeof g.target === "number" && (g.target ?? 0) > 0,
  );
  if (measurable.length === 0) return null;

  return (
    <Card className="p-5 bg-gradient-card border-border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display text-2xl">Today's Targets</h3>
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString(undefined, { month: "long", day: "numeric" })} · what to log today
          </p>
        </div>
        <Link to="/goals-2026" className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-gold hover:text-gold-soft">
          All goals <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-2.5">
        {measurable.map((g) => {
          const projection = computeProjection(g);
          const loggedToday = (g.progressLog ?? {})[today] !== undefined;
          const reqDay = projection.requiredDailyRate ?? 0;
          const pct = progressPct(g);
          const isAhead = (projection.actualDailyRate ?? 0) >= reqDay && reqDay > 0;

          return (
            <div
              key={g.id}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 bg-background/40 border border-border/50 hover:border-gold/30 transition-all"
            >
              {/* Logged indicator */}
              <div className="shrink-0">
                {loggedToday ? (
                  <CheckCircle2 className="h-4 w-4 text-teal" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/40" />
                )}
              </div>

              {/* Goal info */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-foreground leading-tight line-clamp-1">
                    {g.title}
                  </span>
                  {loggedToday && (
                    <span className="font-mono text-[8px] tracking-[0.2em] uppercase text-teal shrink-0">
                      logged ✓
                    </span>
                  )}
                </div>
                {/* Progress bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-muted/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-gold transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-muted-foreground shrink-0 tabular-nums">
                    {fmtGoalVal(g.current ?? 0, g.unit)}&nbsp;/&nbsp;{fmtGoalVal(g.target!, g.unit)}
                  </span>
                </div>
              </div>

              {/* Required-today + pace icon */}
              <div className="shrink-0 text-right min-w-[4rem]">
                {isFinite(reqDay) && reqDay > 0 ? (
                  <>
                    <div className="flex items-center justify-end gap-0.5 mb-0.5">
                      {isAhead ? (
                        <TrendingUp className="h-3 w-3 text-teal" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-orange-400" />
                      )}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground leading-none">need/day</div>
                    <div className={`font-display text-lg leading-tight ${isAhead ? "text-teal" : "text-gold"}`}>
                      {fmtGoalVal(reqDay, g.unit)}
                    </div>
                  </>
                ) : (
                  <div className="font-mono text-[9px] text-muted-foreground">no target</div>
                )}
              </div>

              {/* Quick +1 log button */}
              <button
                type="button"
                onClick={() => onQuickLog(g.id, reqDay > 0 ? Math.round(reqDay) || 1 : 1)}
                title={`Log ${fmtGoalVal(reqDay > 0 ? Math.round(reqDay) : 1, g.unit)} toward ${g.title}`}
                className="shrink-0 h-8 w-8 rounded-md border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 transition-colors flex items-center justify-center font-mono text-sm"
              >
                +
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { profile, user } = useAuth();
  const userName = profile?.display_name?.trim() || user?.email?.split("@")[0] || "sir";
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const { habits, habitLogs, setHabitLogs } = useCloudHabits();
  const [brain] = useLocalStorage<BrainEntry[]>("alfred.brain", []);
  const [focus] = useLocalStorage<FocusStats>("alfred.focus.stats", {
    date: todayKey(),
    sessions: 0,
    minutes: 0,
  });
  const [journal] = useLocalStorage<JournalEntry[]>("alfred.journal", []);
  const { goals, setGoals } = useCloudGoals();

  /* ── Auto daily snapshot ───────────────────────────────────────────────────
     Once per calendar day, stamp each active measurable goal's *current*
     value into progressLog[today] if no entry exists yet. This fills the
     weekly chart on days you don't manually log, so you always see where
     the goal stood rather than a gap.
  ─────────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (goals.length === 0) return;
    const today = todayKey();
    if (localStorage.getItem(SNAP_KEY) === today) return; // already done today

    let changed = false;
    const updated = goals.map((g) => {
      // Only measurable, in-progress goals that have been started at some point
      if (g.done) return g;
      if (typeof g.target !== "number" || g.target <= 0) return g;
      if (typeof g.current !== "number") return g;
      if ((g.progressLog ?? {})[today] !== undefined) return g; // already has today

      changed = true;
      return {
        ...g,
        progressLog: { ...(g.progressLog ?? {}), [today]: g.current },
      };
    });

    if (changed) setGoals(updated);
    localStorage.setItem(SNAP_KEY, today);
  // Run once when goals finish loading (goals.length flips from 0 → N)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals.length > 0]);

  /* ── Quick-log from Today's Targets card ─────────────────────────────── */
  const handleQuickLog = (goalId: string, delta: number) => {
    const today = todayKey();
    const now = Date.now();
    const updated = goals.map((g) => {
      if (g.id !== goalId) return g;
      const prev = g.current ?? 0;
      const next = prev + delta;
      return {
        ...g,
        current: next,
        progressLog: { ...(g.progressLog ?? {}), [today]: next },
        lastCheckIn: today,
        localUpdatedAt: now,
      };
    });
    setGoals(updated);
  };

  const goalStats = useMemo(() => {
    const total = goals.length;
    const done = goals.filter((g) => g.done).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const active = goals
      .filter((g) => !g.done)
      .sort((a, b) => {
        const da = daysUntil(a.deadline);
        const db = daysUntil(b.deadline);
        if (da !== null && db !== null) return da - db;
        if (da !== null) return -1;
        if (db !== null) return 1;
        return progressPct(b) - progressPct(a);
      })
      .slice(0, 4);
    return { total, done, pct, active };
  }, [goals]);

  const todaysBrain = useMemo(
    () => brain.filter((b) => b.date === todayKey()).length,
    [brain]
  );

  const dailyHabits = useMemo(
    () => habits.filter((h) => h.cadence === "daily" && !h.archived),
    [habits]
  );
  const tasksDone = useMemo(
    () => dailyHabits.filter((h) => isCompleteForPeriod(h, habitLogs)).length,
    [dailyHabits, habitLogs]
  );
  const tasksTotal = dailyHabits.length;
  const dailyPct = tasksTotal ? Math.round((tasksDone / tasksTotal) * 100) : 0;

  // Streak
  const [streak, setStreak] = useLocalStorage<StreakState>(STREAK_KEY, emptyStreak);
  useEffect(() => {
    const isComplete = tasksTotal > 0 && tasksDone === tasksTotal;
    const next = reconcileToday(streak, isComplete);
    if (next !== streak) setStreak(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasksDone, tasksTotal]);

  const current = currentStreak(streak);
  const longest = Math.max(longestStreak(streak), current);
  const week = last7Days(streak);

  const recoveries = useMemo(
    () => habitsAtRisk(habits, habitLogs),
    [habits, habitLogs]
  );

  const habitSummary = useMemo(() => {
    const cats = ["career", "body", "money", "skill", "life"] as const;
    const out: Record<string, number> = {};
    cats.forEach((c) => { out[c] = brain.filter((b) => b.label === c).length; });
    return out;
  }, [brain]);

  const stats = [
    { icon: CheckSquare, label: "Tasks complete", value: `${tasksDone}/${tasksTotal}`, to: "/checklist" },
    { icon: Timer, label: "Focus sessions", value: focus.date === todayKey() ? focus.sessions : 0, to: "/focus" },
    { icon: Brain, label: "Brain dumps today", value: todaysBrain, to: "/brain-dump" },
    { icon: Mic, label: "Journal entries", value: journal.length, to: "/journal" },
  ];

  /* ── Date display helpers ─────────────────────────────────────────────── */
  const dayOfWeek = now.toLocaleDateString(undefined, { weekday: "long" });
  const monthDay  = now.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  const fullYear  = now.getFullYear();
  const timeStr   = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-10">

      {/* ── Date + Greeting hero ── */}
      <div className="space-y-1">
        {/* Date banner */}
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-gradient-gold flex flex-col items-center justify-center shadow-gold shrink-0">
            <span className="font-mono text-[8px] uppercase tracking-widest text-primary-foreground/80 leading-none">
              {now.toLocaleDateString(undefined, { month: "short" })}
            </span>
            <span className="font-display text-xl text-primary-foreground leading-none font-bold">
              {now.getDate()}
            </span>
          </div>
          <div>
            <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-gold">
              {dayOfWeek} · {monthDay}, {fullYear}
            </div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
              {timeStr}
            </div>
          </div>
        </div>

        {/* Greeting */}
        <h1 className="font-display text-5xl sm:text-6xl leading-[1.05]">
          {greeting(now)},
          <span className="block italic text-gold">{userName}.</span>
        </h1>
        <p className="text-muted-foreground max-w-xl">
          Your daily protocol awaits. The agenda is set, the timer primed, the journal open.
        </p>
        <div className="divider-gold mt-4" />
        <div className="mt-4">
          <BackupRestore />
        </div>
      </div>

      {/* Right now / Up next — command-center glance */}
      <section>
        <TodayNowNext />
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Link key={s.label} to={s.to}>
            <Card className="p-5 bg-gradient-card border-border hover:border-gold/40 transition-all hover:shadow-gold cursor-pointer h-full">
              <div className="flex items-start justify-between">
                <s.icon className="h-5 w-5 text-gold" />
                <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
              </div>
              <div className="mt-4 font-display text-4xl text-foreground">{s.value}</div>
              <div className="mt-1 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                {s.label}
              </div>
            </Card>
          </Link>
        ))}
      </section>

      {/* ── Today's Targets (goals that need a daily log) ── */}
      <section>
        <TodayGoalsCard goals={goals} onQuickLog={handleQuickLog} />
      </section>

      {/* Daily streak */}
      <section>
        <Card className="p-6 bg-gradient-card border-border">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-md bg-gradient-gold flex items-center justify-center shadow-gold">
                <Flame className="h-7 w-7 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-display text-2xl">Daily Streak</h3>
                <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mt-0.5">
                  {current === 0
                    ? "Complete the protocol to begin"
                    : current === 1
                      ? "1 day · the campaign begins"
                      : `${current} days · longest ${longest}`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-6xl text-gold leading-none">{current}</div>
              <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-muted-foreground mt-1">
                day{current === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-1.5">
            {week.map((d) => {
              const date = new Date(d.date + "T00:00:00");
              const isToday = d.date === todayKey();
              const dayLabel = date.toLocaleDateString([], { weekday: "narrow" });
              return (
                <div key={d.date} className="text-center">
                  <div className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/60 mb-1">
                    {dayLabel}
                  </div>
                  <div
                    className={`aspect-square rounded-md flex items-center justify-center font-mono text-[10px] transition-all ${
                      d.done
                        ? "bg-gradient-gold text-primary-foreground shadow-gold"
                        : isToday
                          ? "bg-muted/40 border border-gold/40 text-gold"
                          : "bg-muted/30 text-muted-foreground/40"
                    }`}
                  >
                    {d.done ? <Flame className="h-3.5 w-3.5" /> : date.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {dailyPct < 100 && current === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              {tasksTotal - tasksDone} task{tasksTotal - tasksDone === 1 ? "" : "s"} between you and day one.
            </p>
          )}
          {dailyPct < 100 && current > 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Hold the line — finish today's protocol to extend the streak.
            </p>
          )}
          {dailyPct === 100 && (
            <p className="mt-4 text-sm text-gold font-display italic">
              Today is conquered, sir. The streak holds.
            </p>
          )}
        </Card>
      </section>

      {/* Habits at risk */}
      {recoveries.length > 0 && (
        <section className="space-y-2">
          <RecoveryPanel
            recoveries={recoveries}
            onMarkDone={(id) => {
              const habit = habits.find((h) => h.id === id);
              if (!habit) return;
              setHabitLogs(toggleHabitForToday(habit, habitLogs).logs);
            }}
            compact
            limit={3}
          />
          <div className="text-right">
            <Link
              to="/checklist"
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] text-gold hover:text-gold-soft"
            >
              Open recovery plan <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </section>
      )}

      {/* Today's agenda */}
      <section>
        <TodayAgendaCard />
      </section>

      {/* Health summary */}
      <section>
        <HealthSummaryCard />
      </section>

      {/* 2026 Goals widget */}
      <section>
        <Card className="p-6 bg-gradient-card border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-gold" />
              <div>
                <h3 className="font-display text-2xl">2026 Campaign</h3>
                <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mt-0.5">
                  {goalStats.done}/{goalStats.total} conquered · {goalStats.pct}%
                </p>
              </div>
            </div>
            <Link
              to="/goals-2026"
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] text-gold hover:text-gold-soft"
            >
              Open <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <Progress value={goalStats.pct} className="h-1.5 mb-4" />
          {goalStats.active.length === 0 ? (
            <p className="font-display italic text-muted-foreground text-sm">
              All goals conquered. Set the next campaign.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {goalStats.active.map((g) => {
                const pct = progressPct(g);
                const days = daysUntil(g.deadline);
                return (
                  <Link
                    key={g.id}
                    to="/goals-2026"
                    className="group p-3 rounded-md bg-background/40 border border-border/60 hover:border-gold/40 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm text-foreground group-hover:text-gold transition-colors line-clamp-1">
                        {g.title}
                      </div>
                      {g.quarter && (
                        <span className="font-mono text-[9px] tracking-wider text-gold/70 flex-shrink-0">
                          {g.quarter}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-gold" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="font-mono text-[9px] text-muted-foreground whitespace-nowrap">
                        {days !== null
                          ? days < 0 ? "overdue" : `${days}d left`
                          : g.category.toLowerCase()}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </section>

      {/* Daily progress + habits */}
      <section className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-gradient-card border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-2xl">Daily Protocol</h3>
            <span className="font-mono text-xs text-gold">{dailyPct}%</span>
          </div>
          <Progress value={dailyPct} className="h-2" />
          <p className="mt-3 text-sm text-muted-foreground">
            {dailyPct === 100
              ? "Magnificent. The day is yours."
              : `${tasksTotal - tasksDone} task${tasksTotal - tasksDone === 1 ? "" : "s"} remain.`}
          </p>
          <Link
            to="/checklist"
            className="mt-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gold hover:text-gold-soft"
          >
            Open checklist <ArrowRight className="h-3 w-3" />
          </Link>
        </Card>

        <Card className="p-6 bg-gradient-card border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-2xl">Habit Summary</h3>
            <Flame className="h-4 w-4 text-gold" />
          </div>
          <div className="space-y-3">
            {Object.entries(habitSummary).map(([k, v]) => {
              const pct = Math.min(100, v * 10);
              return (
                <div key={k}>
                  <div className="flex justify-between text-xs font-mono uppercase tracking-wider mb-1">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="text-gold">{v}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-gold transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>
    </div>
  );
}
