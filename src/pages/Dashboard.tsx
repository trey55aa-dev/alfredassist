import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckSquare, Timer, Brain, Mic, ArrowRight, Flame, Target } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { greeting, todayKey } from "@/lib/alfred";
import { GOALS_KEY, Goal, SEED_GOALS, progressPct, daysUntil } from "@/lib/goals";
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
  HABITS_KEY,
  HABIT_LOGS_KEY,
  Habit,
  HabitLog,
  SEED_HABITS,
  habitsAtRisk,
  isCompleteForPeriod,
} from "@/lib/habits";
import { RecoveryPanel } from "@/components/RecoveryPanel";

interface FocusStats { date: string; sessions: number; minutes: number; }

export default function Dashboard() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const [habits] = useLocalStorage<Habit[]>(HABITS_KEY, SEED_HABITS);
  const [habitLogs] = useLocalStorage<HabitLog[]>(HABIT_LOGS_KEY, []);
  const [brain] = useLocalStorage<BrainEntry[]>("alfred.brain", []);
  const [focus] = useLocalStorage<FocusStats>("alfred.focus.stats", {
    date: todayKey(),
    sessions: 0,
    minutes: 0,
  });
  const [journal] = useLocalStorage<JournalEntry[]>("alfred.journal", []);
  const [goals] = useLocalStorage<Goal[]>(GOALS_KEY, SEED_GOALS);

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

  // Streak — keep in sync if user lands here without visiting Checklist
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

  // Habit summary: brain dumps by category
  const habitSummary = useMemo(() => {
    const cats = ["career", "body", "money", "skill", "life"] as const;
    const out: Record<string, number> = {};
    cats.forEach((c) => {
      out[c] = brain.filter((b) => b.label === c).length;
    });
    return out;
  }, [brain]);

  const stats = [
    { icon: CheckSquare, label: "Tasks complete", value: `${tasksDone}/${tasksTotal}`, to: "/checklist" },
    { icon: Timer, label: "Focus sessions", value: focus.date === todayKey() ? focus.sessions : 0, to: "/focus" },
    { icon: Brain, label: "Brain dumps today", value: todaysBrain, to: "/brain-dump" },
    { icon: Mic, label: "Journal entries", value: journal.length, to: "/journal" },
  ];

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-gold">
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
        <h1 className="font-display text-5xl sm:text-6xl leading-[1.05]">
          {greeting(now)},
          <span className="block italic text-gold">sir.</span>
        </h1>
        <p className="text-muted-foreground max-w-xl">
          Your daily protocol awaits. The agenda is set, the timer primed, the journal open.
        </p>
        <div className="divider-gold mt-4" />
        <div className="mt-4">
          <BackupRestore />
        </div>
      </div>

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
              <div className="font-display text-6xl text-gold leading-none">
                {current}
              </div>
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
                        <div
                          className="h-full bg-gradient-gold"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="font-mono text-[9px] text-muted-foreground whitespace-nowrap">
                        {days !== null
                          ? days < 0
                            ? "overdue"
                            : `${days}d left`
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
            {Object.entries(habits).map(([k, v]) => {
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
