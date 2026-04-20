import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckSquare, Timer, Brain, Mic, ArrowRight, Flame, Target } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { greeting, todayKey } from "@/lib/alfred";
import { GOALS_KEY, Goal, SEED_GOALS, progressPct, daysUntil } from "@/lib/goals";
import type { ChecklistState } from "./Checklist";
import type { BrainEntry } from "./BrainDump";
import type { JournalEntry } from "./Journal";
import { BackupRestore } from "@/components/BackupRestore";

interface FocusStats { date: string; sessions: number; minutes: number; }

export default function Dashboard() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const [checklist] = useLocalStorage<ChecklistState>("alfred.checklist", {
    date: todayKey(),
    daily: {},
    weekly: {},
  });
  const [brain] = useLocalStorage<BrainEntry[]>("alfred.brain", []);
  const [focus] = useLocalStorage<FocusStats>("alfred.focus.stats", {
    date: todayKey(),
    sessions: 0,
    minutes: 0,
  });
  const [journal] = useLocalStorage<JournalEntry[]>("alfred.journal", []);

  const todaysBrain = useMemo(
    () => brain.filter((b) => b.date === todayKey()).length,
    [brain]
  );

  const tasksDone = useMemo(
    () => Object.values(checklist.daily ?? {}).filter(Boolean).length,
    [checklist]
  );
  const tasksTotal = useMemo(() => Object.keys(checklist.daily ?? {}).length || 1, [checklist]);
  const dailyPct = Math.round((tasksDone / tasksTotal) * 100);

  // Habit summary: last 7 days of brain dumps + journal entries by category
  const habits = useMemo(() => {
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
