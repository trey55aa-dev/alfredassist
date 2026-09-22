import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Sunrise, Star, ArrowRight, CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { HabitRings } from "@/components/HabitRings";
import { buildBriefing, type Tone } from "@/lib/briefing";
import { getDailyHighlight } from "@/lib/dailyHighlight";
import { todayKey } from "@/lib/alfred";
import { useCloudHabits } from "@/hooks/useCloudHabits";
import { useCloudGoals } from "@/hooks/useCloudGoals";
import { applyHabitToggle } from "@/lib/habitToggle";
import type { Habit } from "@/lib/habits";

const TONE_CLASS: Record<Tone, string> = {
  gold: "text-gold",
  teal: "text-teal",
  coral: "text-coral",
  muted: "text-muted-foreground",
};

export default function DailyPlanning() {
  const { habits, habitLogs: logs, setHabitLogs: setLogs } = useCloudHabits();
  const { goals, setGoals } = useCloudGoals();
  const briefing = useMemo(() => buildBriefing("morning"), []);
  const highlight = getDailyHighlight(todayKey());

  const dailyHabits = useMemo(
    () => habits.filter((h) => !h.archived && h.cadence === "daily"),
    [habits],
  );

  const handleToggle = (habit: Habit) => {
    const next = applyHabitToggle(habit, logs, goals);
    setLogs(next.logs);
    if (next.goals !== goals) setGoals(next.goals);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Start here"
        title="Daily Planning"
        description="Set today up before the day sets itself up for you."
      />

      <Card className="p-6 bg-gradient-card border-border">
        <div className="flex items-center gap-2 mb-1">
          <Sunrise className="h-4 w-4 text-gold" />
          <p className="font-display italic text-muted-foreground">{briefing.greeting}</p>
        </div>
        <h2 className={`font-display text-2xl ${TONE_CLASS[briefing.headlineTone]}`}>
          {briefing.headline}
        </h2>
        {briefing.items.length > 0 && (
          <ul className="mt-4 space-y-2">
            {briefing.items.map((item, i) => (
              <li key={i} className={`flex items-start gap-2 text-sm ${TONE_CLASS[item.tone]}`}>
                <span className="shrink-0">{item.icon}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 font-display italic text-sm text-muted-foreground">{briefing.closer}</p>
      </Card>

      <Card className="p-6 bg-gradient-card border-border">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-gold" />
            <h3 className="font-display text-xl">Today's highlight</h3>
          </div>
          <Link
            to="/daily-highlights"
            className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.2em] uppercase text-gold hover:text-gold-soft"
          >
            {highlight ? "Change" : "Set one"} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <p className={highlight ? "text-sm text-foreground/90" : "text-sm text-muted-foreground italic"}>
          {highlight || "Not set yet — pick the one thing that would make today a win."}
        </p>
      </Card>

      {dailyHabits.length > 0 && (
        <Card className="p-6 bg-gradient-card border-border">
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-4">
            Today's habits
          </p>
          <HabitRings habits={dailyHabits} logs={logs} onToggle={handleToggle} />
        </Card>
      )}

      <Link
        to="/agenda"
        className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/40 p-4 hover:border-gold/30 transition-all group"
      >
        <span className="flex items-center gap-2 text-sm text-foreground">
          <CalendarDays className="h-4 w-4 text-gold" />
          Open today's agenda
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-gold transition-colors" />
      </Link>
    </div>
  );
}
