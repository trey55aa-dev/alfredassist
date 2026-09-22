import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Moon, Star, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { DailyRecap } from "@/components/DailyRecap";
import { buildBriefing, type Tone } from "@/lib/briefing";
import { getDailyHighlight } from "@/lib/dailyHighlight";
import { todayKey } from "@/lib/alfred";
import { getTodayEvents, filterToDay, sortByStart, type AgendaEvent } from "@/lib/agenda";
import { useCloudHabits } from "@/hooks/useCloudHabits";

const TONE_CLASS: Record<Tone, string> = {
  gold: "text-gold",
  teal: "text-teal",
  coral: "text-coral",
  muted: "text-muted-foreground",
};

export default function DailyShutdown() {
  const { habits, habitLogs } = useCloudHabits();
  const [events, setEvents] = useState<AgendaEvent[] | null>(null);
  const now = useMemo(() => new Date(), []);
  const briefing = useMemo(() => buildBriefing("evening", now), [now]);
  const highlight = getDailyHighlight(todayKey());

  useEffect(() => {
    getTodayEvents().then(setEvents);
  }, []);

  const today = useMemo(
    () => (events ? sortByStart(filterToDay(events, now)) : []),
    [events, now],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Close it out"
        title="Daily Shutdown"
        description="Look back before you look away. Whatever didn't get done stays right where you left it — tomorrow, not a failure."
      />

      <Card className="p-6 bg-gradient-card border-border">
        <div className="flex items-center gap-2 mb-1">
          <Moon className="h-4 w-4 text-gold" />
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

      {highlight && (
        <Card className="p-5 bg-gradient-card border-border">
          <div className="flex items-center gap-2 mb-2">
            <Star className="h-3.5 w-3.5 text-gold" />
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
              This morning's highlight
            </p>
          </div>
          <p className="text-sm text-foreground/90 italic">"{highlight}"</p>
        </Card>
      )}

      {events !== null && (
        <DailyRecap events={today} habits={habits} habitLogs={habitLogs} now={now} />
      )}

      <Link
        to="/daily-planning"
        className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/40 p-4 hover:border-gold/30 transition-all group"
      >
        <span className="text-sm text-foreground">Tomorrow starts with Daily Planning</span>
        <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-gold transition-colors" />
      </Link>
    </div>
  );
}
