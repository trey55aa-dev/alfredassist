import { useMemo, useState } from "react";
import { Flame, Target, Timer as TimerIcon, Trophy, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { todayKey } from "@/lib/alfred";
import { GOALS_KEY, type Goal } from "@/lib/goals";
import { getGamification, levelFromXp, xpToNextLevel } from "@/lib/gamification";
import { STREAK_KEY, currentStreak, type StreakState } from "@/lib/streak";
import { HABITS_KEY, HABIT_LOGS_KEY, type Habit, type HabitLog } from "@/lib/habits";

/* ---------- storage helpers ---------- */

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

interface TimerHistoryEntry {
  totalSeconds: number;
  startedAt: number;
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Array of the last `n` day-keys (YYYY-MM-DD), oldest first, including today. */
function lastNDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(todayKey(d));
  }
  return out;
}

/* ---------- small presentational bits ---------- */

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  tone = "text-gold",
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <Card className="p-4 bg-gradient-card border-border">
      <Icon className={`h-4 w-4 ${tone}`} />
      <div className={`font-display text-3xl mt-2 ${tone}`}>{value}</div>
      <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground mt-0.5">
        {label}
      </div>
      {sub && <div className="font-mono text-[10px] text-muted-foreground/70 mt-1">{sub}</div>}
    </Card>
  );
}

function Bar({ pct, tone = "from-gold/70 to-gold" }: { pct: number; tone?: string }) {
  return (
    <div className="h-2 rounded-full bg-background/60 border border-border overflow-hidden">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${tone} transition-all duration-700`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

/* ---------- page ---------- */

export default function Review() {
  const [days, setDays] = useState<7 | 30>(7);

  const data = useMemo(() => {
    const range = lastNDays(days);
    const rangeSet = new Set(range);
    const cutoff = Date.now() - days * 86_400_000;
    const today = todayKey();

    // Goals
    const goals = read<Goal[]>(GOALS_KEY, []);
    const doneGoals = goals.filter((g) => g.done).length;
    const checkedInGoals = goals.filter((g) => g.lastCheckIn && rangeSet.has(g.lastCheckIn));
    const money = goals.filter((g) => g.category === "Money");
    const debtRemaining = money
      .filter((g) => g.financialType === "debt")
      .reduce((s, g) => s + Math.max(0, (g.target ?? 0) - (g.current ?? 0)), 0);
    const saved = money
      .filter((g) => g.financialType === "savings")
      .reduce((s, g) => s + (g.current ?? 0), 0);
    const budgetGoals = money.filter((g) => g.financialType === "budget");
    const budgetSpent = budgetGoals.reduce((s, g) => s + (g.current ?? 0), 0);
    const budgetCap = budgetGoals.reduce((s, g) => s + (g.target ?? 0), 0);

    // Habits (daily only — those have a meaningful per-day rate)
    const habits = read<Habit[]>(HABITS_KEY, []).filter((h) => !h.archived);
    const logs = read<HabitLog[]>(HABIT_LOGS_KEY, []);
    const dailyHabits = habits.filter((h) => h.cadence === "daily");
    const logSet = new Set(logs.map((l) => `${l.habitId}|${l.date}`));
    const perHabit = dailyHabits.map((h) => {
      const ticks = range.map((d) => logSet.has(`${h.id}|${d}`));
      return { habit: h, ticks, done: ticks.filter(Boolean).length };
    });
    const possible = dailyHabits.length * days;
    const completed = perHabit.reduce((s, p) => s + p.done, 0);
    const habitPct = possible > 0 ? Math.round((completed / possible) * 100) : 0;

    // Streak
    const streak = read<StreakState>(STREAK_KEY, { completedDays: {} });
    const streakNow = currentStreak(streak);
    const fullDaysInRange = range.filter((d) => streak.completedDays[d]).length;

    // Focus (task timers)
    const history = read<TimerHistoryEntry[]>("alfred.timer.history", []);
    const inRange = history.filter((h) => h.startedAt >= cutoff);
    const focusSeconds = inRange.reduce((s, h) => s + (h.totalSeconds || 0), 0);
    const focusHours = focusSeconds / 3600;
    const focusStats = read<{ date: string; sessions: number; minutes: number }>(
      "alfred.focus.stats",
      { date: "", sessions: 0, minutes: 0 },
    );
    const todaySessions = focusStats.date === today ? focusStats.sessions : 0;

    // Momentum
    const g = getGamification();
    const level = levelFromXp(g.xp);
    const xpNext = xpToNextLevel(g.xp);

    return {
      goals,
      doneGoals,
      checkedInGoals,
      money,
      debtRemaining,
      saved,
      budgetGoals,
      budgetSpent,
      budgetCap,
      perHabit,
      habitPct,
      completed,
      possible,
      streakNow,
      fullDaysInRange,
      focusHours,
      focusSessions: inRange.length,
      todaySessions,
      level,
      xp: g.xp,
      xpNext,
      badges: g.earnedBadges.length,
    };
  }, [days]);

  const rangeLabel = days === 7 ? "last 7 days" : "last 30 days";
  const goalPct = data.goals.length ? Math.round((data.doneGoals / data.goals.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reflection"
        title={days === 7 ? "Weekly Review" : "Monthly Review"}
        description="How did the campaign go? Goals, habits, focus, and money — at a glance."
        actions={
          <div className="flex rounded-lg border border-border overflow-hidden">
            {([7, 30] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`px-4 py-2 font-mono text-[11px] tracking-wider uppercase transition-colors ${
                  days === d
                    ? "bg-gold text-primary-foreground"
                    : "bg-background/40 text-muted-foreground hover:text-gold"
                }`}
              >
                {d === 7 ? "Week" : "Month"}
              </button>
            ))}
          </div>
        }
      />

      {/* Top stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          icon={Trophy}
          label={`Level · ${data.level.title}`}
          value={`L${data.level.level}`}
          sub={`${data.xp} XP · ${data.badges} badges`}
        />
        <StatTile
          icon={Flame}
          label="Current streak"
          value={`${data.streakNow}`}
          sub={`${data.fullDaysInRange}/${days} full days`}
          tone="text-amber-400"
        />
        <StatTile
          icon={TimerIcon}
          label={`Focus · ${rangeLabel}`}
          value={`${data.focusHours.toFixed(1)}h`}
          sub={`${data.focusSessions} timed sessions`}
          tone="text-teal"
        />
        <StatTile
          icon={TrendingUp}
          label="Habit completion"
          value={`${data.habitPct}%`}
          sub={`${data.completed}/${data.possible} ticks`}
          tone="text-emerald-400"
        />
      </div>

      {/* Goals */}
      <Card className="p-5 bg-gradient-card border-border space-y-4">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-gold" />
          <h3 className="font-display text-xl">Goals</h3>
          <span className="font-mono text-[10px] tracking-wider text-muted-foreground ml-auto">
            {data.doneGoals}/{data.goals.length} done · {goalPct}%
          </span>
        </div>
        <Bar pct={goalPct} />
        <div className="font-mono text-[11px] text-muted-foreground">
          {data.checkedInGoals.length > 0 ? (
            <>
              <span className="text-gold">{data.checkedInGoals.length}</span> goal
              {data.checkedInGoals.length !== 1 ? "s" : ""} updated in the {rangeLabel}:
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.checkedInGoals.slice(0, 8).map((g) => (
                  <span
                    key={g.id}
                    className="rounded border border-gold/30 bg-gold/5 px-2 py-0.5 text-[10px] text-foreground"
                  >
                    {g.title}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <span className="text-muted-foreground/60">No goals updated in the {rangeLabel} — pick one to nudge forward.</span>
          )}
        </div>
      </Card>

      {/* Money */}
      {data.money.length > 0 && (
        <Card className="p-5 bg-gradient-card border-border space-y-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-400" />
            <h3 className="font-display text-xl">Money</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-center">
              <div className="font-display text-2xl text-red-300">{fmtCurrency(data.debtRemaining)}</div>
              <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-muted-foreground mt-1">Debt left</div>
            </div>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
              <div className="font-display text-2xl text-emerald-300">{fmtCurrency(data.saved)}</div>
              <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-muted-foreground mt-1">Saved</div>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-center">
              <div className="font-display text-2xl text-amber-300">
                {data.budgetCap > 0 ? `${Math.round((data.budgetSpent / data.budgetCap) * 100)}%` : "—"}
              </div>
              <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-muted-foreground mt-1">Budget used</div>
            </div>
          </div>
        </Card>
      )}

      {/* Habits */}
      <Card className="p-5 bg-gradient-card border-border space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          <h3 className="font-display text-xl">Daily habits</h3>
          <span className="font-mono text-[10px] tracking-wider text-muted-foreground ml-auto">
            {data.habitPct}% over {rangeLabel}
          </span>
        </div>
        {data.perHabit.length === 0 ? (
          <p className="font-mono text-[11px] text-muted-foreground/60">
            No daily habits yet. Add some in the Checklist to track them here.
          </p>
        ) : (
          <div className="space-y-2.5">
            {data.perHabit.map(({ habit, ticks, done }) => (
              <div key={habit.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-foreground truncate">{habit.title}</div>
                  <div className="font-mono text-[9px] tracking-wider text-muted-foreground">
                    {done}/{days} days
                  </div>
                </div>
                {/* show up to last 14 ticks as dots to keep it tidy */}
                <div className="flex gap-1 shrink-0">
                  {ticks.slice(-14).map((t, i) => (
                    <span
                      key={i}
                      className={`h-2.5 w-2.5 rounded-full ${
                        t ? "bg-emerald-400" : "bg-background/60 border border-border"
                      }`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Focus */}
      <Card className="p-5 bg-gradient-card border-border space-y-3">
        <div className="flex items-center gap-2">
          <TimerIcon className="h-4 w-4 text-teal" />
          <h3 className="font-display text-xl">Focus</h3>
        </div>
        <div className="grid grid-cols-3 gap-3 font-mono text-center">
          <div>
            <div className="font-display text-2xl text-teal">{data.focusHours.toFixed(1)}h</div>
            <div className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground mt-1">Tracked · {rangeLabel}</div>
          </div>
          <div>
            <div className="font-display text-2xl text-teal">{data.focusSessions}</div>
            <div className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground mt-1">Timed sessions</div>
          </div>
          <div>
            <div className="font-display text-2xl text-gold">{data.todaySessions}</div>
            <div className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground mt-1">Focus today</div>
          </div>
        </div>
      </Card>

      <p className="font-mono text-[9px] tracking-wider text-muted-foreground/50 text-center pb-4">
        Read-only summary · pulled from your goals, habits, focus timers, and money goals.
      </p>
    </div>
  );
}
