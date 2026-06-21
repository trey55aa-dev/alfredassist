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
import { ProgressRing } from "@/components/ProgressRing";

interface FocusStats { date: string; sessions: number; minutes: number; }

const SNAP_KEY = "alfred.goals.dailySnap";

function fmtGoalVal(n: number, unit: string | undefined): string {
  if (!isFinite(n) || n === 0) return "—";
  const isMonetary = unit === "$" || unit?.toLowerCase() === "usd";
  if (isMonetary) return `$${Math.round(n).toLocaleString()}`;
  const str = n >= 10 ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, "");
  return unit ? `${str} ${unit}` : str;
}

/** Coloured tile for each stat. */
const TILE_COLORS = {
  teal:   { text: "hsl(180 40% 58%)", iconBg: "bg-teal/15",   icon: "text-teal"   },
  violet: { text: "hsl(263 58% 75%)", iconBg: "bg-violet/15", icon: "text-violet" },
  gold:   { text: "hsl(42 55% 65%)",  iconBg: "bg-gold/15",   icon: "text-gold"   },
  coral:  { text: "hsl(348 72% 72%)", iconBg: "bg-coral/15",  icon: "text-coral"  },
} as const;
type TileColor = keyof typeof TILE_COLORS;

function StatTile({
  icon: Icon,
  label,
  value,
  to,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  to: string;
  color: TileColor;
}) {
  const c = TILE_COLORS[color];
  return (
    <Link to={to} className="block h-full">
      <div className={`stat-tile stat-tile-${color} rounded-2xl p-4 sm:p-5 flex flex-col h-full border border-transparent`}>
        <div className="flex items-start justify-between mb-4">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${c.iconBg}`}>
            <Icon className={`h-5 w-5 ${c.icon}`} />
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/30" />
        </div>
        <div className="font-display text-5xl leading-none" style={{ color: c.text }}>
          {value}
        </div>
        <div className="mt-2 font-mono text-[10px] tracking-[0.22em] uppercase text-muted-foreground/70">
          {label}
        </div>
      </div>
    </Link>
  );
}

/** Today at a Glance — goal logging rows. */
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
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.28em] uppercase text-gold mb-1">
            <span className="h-1 w-1 rounded-full bg-gold inline-block" />
            Today's Targets
          </p>
          <h3 className="font-display text-2xl">What to log today</h3>
        </div>
        <Link to="/goals-2026" className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-gold/70 hover:text-gold transition-colors">
          All <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-2">
        {measurable.map((g) => {
          const projection = computeProjection(g);
          const loggedToday = (g.progressLog ?? {})[today] !== undefined;
          const reqDay = projection.requiredDailyRate ?? 0;
          const pct = progressPct(g);
          const isAhead = (projection.actualDailyRate ?? 0) >= reqDay && reqDay > 0;

          return (
            <div
              key={g.id}
              className="flex items-center gap-3 rounded-xl px-3 py-3 bg-background/50 border border-border/40 hover:border-gold/25 transition-all"
            >
              <div className="shrink-0">
                {loggedToday
                  ? <CheckCircle2 className="h-4.5 w-4.5 text-teal" />
                  : <Circle className="h-4.5 w-4.5 text-muted-foreground/30" />}
              </div>

              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground line-clamp-1">{g.title}</span>
                  {loggedToday && (
                    <span className="font-mono text-[8px] tracking-[0.2em] uppercase text-teal shrink-0">logged ✓</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-gold transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="font-mono text-[9px] text-muted-foreground/60 shrink-0 tabular-nums">
                    {fmtGoalVal(g.current ?? 0, g.unit)} / {fmtGoalVal(g.target!, g.unit)}
                  </span>
                </div>
              </div>

              <div className="shrink-0 text-right min-w-[3.5rem]">
                {isFinite(reqDay) && reqDay > 0 && (
                  <>
                    {isAhead
                      ? <TrendingUp className="h-3 w-3 text-teal ml-auto mb-0.5" />
                      : <TrendingDown className="h-3 w-3 text-coral ml-auto mb-0.5" />}
                    <div className={`font-display text-base leading-none ${isAhead ? "text-teal" : "text-coral"}`}>
                      {fmtGoalVal(reqDay, g.unit)}
                    </div>
                    <div className="font-mono text-[8px] text-muted-foreground/50">need/day</div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => onQuickLog(g.id, reqDay > 0 ? Math.round(reqDay) || 1 : 1)}
                className="shrink-0 h-8 w-8 rounded-xl border border-gold/30 bg-gold/10 text-gold hover:bg-gold/25 active:scale-95 transition-all flex items-center justify-center font-mono text-base font-bold"
              >
                +
              </button>
            </div>
          );
        })}
      </div>
    </div>
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

  useEffect(() => {
    if (goals.length === 0) return;
    const today = todayKey();
    if (localStorage.getItem(SNAP_KEY) === today) return;
    let changed = false;
    const updated = goals.map((g) => {
      if (g.done) return g;
      if (typeof g.target !== "number" || g.target <= 0) return g;
      if (typeof g.current !== "number") return g;
      if ((g.progressLog ?? {})[today] !== undefined) return g;
      changed = true;
      return { ...g, progressLog: { ...(g.progressLog ?? {}), [today]: g.current } };
    });
    if (changed) setGoals(updated);
    localStorage.setItem(SNAP_KEY, today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals.length > 0]);

  const handleQuickLog = (goalId: string, delta: number) => {
    const today = todayKey();
    const ts = Date.now();
    const updated = goals.map((g) => {
      if (g.id !== goalId) return g;
      const next = (g.current ?? 0) + delta;
      return { ...g, current: next, progressLog: { ...(g.progressLog ?? {}), [today]: next }, lastCheckIn: today, localUpdatedAt: ts };
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
        const da = daysUntil(a.deadline), db = daysUntil(b.deadline);
        if (da !== null && db !== null) return da - db;
        if (da !== null) return -1;
        if (db !== null) return 1;
        return progressPct(b) - progressPct(a);
      })
      .slice(0, 4);
    return { total, done, pct, active };
  }, [goals]);

  const todaysBrain = useMemo(() => brain.filter((b) => b.date === todayKey()).length, [brain]);

  const dailyHabits = useMemo(() => habits.filter((h) => h.cadence === "daily" && !h.archived), [habits]);
  const tasksDone = useMemo(() => dailyHabits.filter((h) => isCompleteForPeriod(h, habitLogs)).length, [dailyHabits, habitLogs]);
  const tasksTotal = dailyHabits.length;
  const dailyPct = tasksTotal ? Math.round((tasksDone / tasksTotal) * 100) : 0;

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

  const recoveries = useMemo(() => habitsAtRisk(habits, habitLogs), [habits, habitLogs]);

  const stats: Array<{ icon: React.ElementType; label: string; value: string | number; to: string; color: TileColor }> = [
    { icon: CheckSquare, label: "Tasks complete",  value: `${tasksDone}/${tasksTotal}`,                              to: "/checklist",   color: "teal"   },
    { icon: Timer,       label: "Focus sessions",  value: focus.date === todayKey() ? focus.sessions : 0,            to: "/focus",       color: "violet" },
    { icon: Brain,       label: "Brain dumps",     value: todaysBrain,                                              to: "/brain-dump",  color: "gold"   },
    { icon: Mic,         label: "Journal entries", value: journal.length,                                           to: "/journal",     color: "coral"  },
  ];

  return (
    <div className="space-y-10">

      {/* ── Greeting ── */}
      <div className="space-y-1">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-gold flex flex-col items-center justify-center shadow-gold shrink-0">
            <span className="font-mono text-[7px] uppercase tracking-widest text-primary-foreground/80 leading-none">
              {now.toLocaleDateString(undefined, { month: "short" })}
            </span>
            <span className="font-display text-2xl text-primary-foreground leading-none font-bold">
              {now.getDate()}
            </span>
          </div>
          <div>
            <div className="font-mono text-[11px] tracking-[0.28em] uppercase text-gold">
              {now.toLocaleDateString(undefined, { weekday: "long" })} · {now.toLocaleDateString(undefined, { month: "long", day: "numeric" })}
            </div>
            <div className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground/60">
              {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>

        <h1 className="font-display text-5xl sm:text-6xl leading-[1.05]">
          {greeting(now)},
          <span className="block italic text-gradient-gold">{userName}.</span>
        </h1>
        <p className="text-muted-foreground/70 text-sm max-w-xl mt-2">
          Your daily protocol awaits. The agenda is set, the timer primed, the journal open.
        </p>
        <div className="divider-gold mt-5" />
        <div className="mt-4">
          <BackupRestore />
        </div>
      </div>

      {/* Right now / Up next */}
      <section>
        <TodayNowNext />
      </section>

      {/* ── Bold stat tiles ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 stagger-in">
        {stats.map((s) => (
          <StatTile key={s.label} {...s} />
        ))}
      </section>

      {/* ── Today's Targets ── */}
      <section>
        <TodayGoalsCard goals={goals} onQuickLog={handleQuickLog} />
      </section>

      {/* ── Daily Protocol + Streak (side by side on lg) ── */}
      <section className="grid lg:grid-cols-5 gap-4 sm:gap-6">

        {/* Daily Protocol — ring + habit list */}
        <div className="lg:col-span-3 glass-card p-5 sm:p-6">
          <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.28em] uppercase text-muted-foreground mb-1">
            <span className="h-1 w-1 rounded-full bg-teal inline-block" />
            Daily Protocol
          </p>
          <div className="flex items-center gap-6 mt-3">
            <ProgressRing
              pct={dailyPct}
              size={112}
              stroke={10}
              color="hsl(180 40% 50%)"
              trackColor="hsl(220 25% 14%)"
              label={`${dailyPct}%`}
              sublabel="done"
            />
            <div className="flex-1 min-w-0">
              <div className="font-display text-3xl leading-tight">
                {tasksDone}
                <span className="text-muted-foreground/40 text-xl"> / {tasksTotal}</span>
              </div>
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground mt-1">
                habits complete
              </p>
              <p className="text-sm text-muted-foreground/70 mt-2">
                {dailyPct === 100
                  ? "Magnificent. The day is yours."
                  : tasksTotal === 0
                  ? "Add habits in Checklist to begin."
                  : `${tasksTotal - tasksDone} habit${tasksTotal - tasksDone === 1 ? "" : "s"} remaining.`}
              </p>
              <Link
                to="/checklist"
                className="mt-3 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-teal hover:text-teal-soft transition-colors"
              >
                Open protocol <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Mini habit list */}
          {dailyHabits.length > 0 && (
            <div className="mt-5 space-y-1.5">
              {dailyHabits.slice(0, 5).map((h) => {
                const done = isCompleteForPeriod(h, habitLogs);
                return (
                  <div key={h.id} className="flex items-center gap-3 py-1.5">
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${done ? "bg-teal border-teal" : "border-border/50"}`}>
                      {done && <span className="text-primary-foreground text-[10px] font-bold">✓</span>}
                    </div>
                    <span className={`text-sm transition-colors ${done ? "line-through text-muted-foreground/40" : "text-foreground/80"}`}>
                      {h.title}
                    </span>
                    {h.streak > 1 && (
                      <span className="ml-auto font-mono text-[9px] text-gold/70 shrink-0">
                        🔥 {h.streak}
                      </span>
                    )}
                  </div>
                );
              })}
              {dailyHabits.length > 5 && (
                <p className="font-mono text-[9px] text-muted-foreground/50 tracking-wider pl-8">
                  +{dailyHabits.length - 5} more in checklist
                </p>
              )}
            </div>
          )}
        </div>

        {/* Streak */}
        <div className="lg:col-span-2 glass-card p-5 sm:p-6 flex flex-col">
          <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.28em] uppercase text-muted-foreground mb-1">
            <span className="h-1 w-1 rounded-full bg-gold inline-block" />
            Daily Streak
          </p>

          <div className="flex items-center gap-4 mt-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-gold flex items-center justify-center shadow-gold shrink-0">
              <Flame className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <div className="font-display text-5xl text-gold leading-none">{current}</div>
              <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-muted-foreground mt-1">
                day{current === 1 ? "" : "s"} · best {longest}
              </div>
            </div>
          </div>

          {/* 7-day dots */}
          <div className="mt-5 grid grid-cols-7 gap-1.5 flex-1">
            {week.map((d) => {
              const date = new Date(d.date + "T00:00:00");
              const isToday = d.date === todayKey();
              return (
                <div key={d.date} className="flex flex-col items-center gap-1">
                  <div className="font-mono text-[8px] uppercase text-muted-foreground/50">
                    {date.toLocaleDateString([], { weekday: "narrow" })}
                  </div>
                  <div
                    className={`w-full aspect-square rounded-full flex items-center justify-center transition-all ${
                      d.done
                        ? "bg-gradient-gold shadow-gold"
                        : isToday
                        ? "border-2 border-gold/40 bg-gold/5"
                        : "bg-muted/25"
                    }`}
                  >
                    {d.done
                      ? <Flame className="h-3 w-3 text-primary-foreground" />
                      : <span className="font-mono text-[9px] text-muted-foreground/40">{date.getDate()}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {dailyPct === 100
            ? <p className="mt-4 text-sm text-gold font-display italic">Today is conquered.</p>
            : <p className="mt-4 text-sm text-muted-foreground/60">
                {current > 0 ? "Finish today's protocol to hold the streak." : "Complete the protocol to begin."}
              </p>}
        </div>
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
            <Link to="/checklist" className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] text-coral hover:text-coral-soft transition-colors">
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

      {/* ── 2026 Campaign ── */}
      <section className="glass-card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gold/15 flex items-center justify-center">
              <Target className="h-5 w-5 text-gold" />
            </div>
            <div>
              <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-gold/70">Campaign</p>
              <h3 className="font-display text-2xl leading-tight">2026 Goals</h3>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-3xl text-gold leading-none">{goalStats.pct}%</div>
            <div className="font-mono text-[8px] tracking-wider uppercase text-muted-foreground">
              {goalStats.done}/{goalStats.total} done
            </div>
          </div>
        </div>

        <Progress value={goalStats.pct} className="h-2 mb-5" />

        {goalStats.active.length === 0 ? (
          <p className="font-display italic text-muted-foreground text-sm">All goals conquered. Set the next campaign.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {goalStats.active.map((g) => {
              const pct = progressPct(g);
              const days = daysUntil(g.deadline);
              return (
                <Link
                  key={g.id}
                  to="/goals-2026"
                  className="group p-3 rounded-xl bg-background/40 border border-border/40 hover:border-gold/30 transition-all hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors line-clamp-1">
                      {g.title}
                    </span>
                    {g.quarter && (
                      <span className="font-mono text-[9px] tracking-wider text-gold/60 shrink-0">{g.quarter}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-gold transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="font-mono text-[9px] text-muted-foreground/60 whitespace-nowrap">
                      {pct}% · {days !== null ? (days < 0 ? "overdue" : `${days}d`) : g.category.toLowerCase()}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-4 text-right">
          <Link to="/goals-2026" className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-gold/70 hover:text-gold transition-colors">
            Full campaign <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </section>
    </div>
  );
}
