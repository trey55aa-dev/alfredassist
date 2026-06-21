import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, Clock, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  type AgendaEvent,
  currentEvent,
  formatEventTime,
  getTodayEvents,
  nextEvent,
} from "@/lib/agenda";
import { tocssColor } from "@/lib/recurring";

function minutesUntil(iso: string, now: Date): number {
  return Math.round((new Date(iso).getTime() - now.getTime()) / 60000);
}

function humanizeIn(mins: number): string {
  if (mins <= 0) return "now";
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `in ${h}h ${m}m` : `in ${h}h`;
}

/**
 * Command-center strip pinned to the top of the Dashboard: the single "what now?"
 * answer — the event happening now, or the next one up, plus a one-tap Focus
 * start. Pulls the merged day (manual + recurring + connected calendars).
 */
export function TodayNowNext() {
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    let alive = true;
    const refresh = () => getTodayEvents().then((e) => { if (alive) setEvents(e); }).catch(() => {});
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("alfred.recurring:changed", refresh);
    return () => {
      alive = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("alfred.recurring:changed", refresh);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const current = currentEvent(events, now);
  const next = nextEvent(events, now);
  const upcoming = events.filter((e) => !e.allDay && new Date(e.start).getTime() > now.getTime()).length;
  const featured = current ?? next;
  const isNow = !!current;
  const accent = featured?.calendarColor ? tocssColor(featured.calendarColor) : "hsl(var(--gold))";

  return (
    <Card className="p-5 bg-gradient-card border-border relative overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: accent }}
        aria-hidden
      />
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
            {featured ? (isNow ? "Happening now" : "Up next") : "Today"}
          </div>

          {featured ? (
            <>
              <Link
                to="/agenda"
                className="font-display text-2xl text-foreground hover:text-gold transition-colors flex items-center gap-2 min-w-0"
              >
                {featured.emoji && <span className="shrink-0">{featured.emoji}</span>}
                <span className="truncate">{featured.title}</span>
              </Link>
              <div className="mt-1 flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatEventTime(featured)}
                </span>
                {!isNow && (
                  <span className="text-gold">{humanizeIn(minutesUntil(featured.start, now))}</span>
                )}
                {upcoming > 0 && (
                  <span className="text-muted-foreground/60">
                    · {upcoming} more today
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="font-display text-2xl text-foreground">Open road ahead</div>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                Nothing scheduled. Build a block or just start focusing.
              </p>
            </>
          )}
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <Link
            to="/focus"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-gold text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Play className="h-4 w-4" /> Focus
          </Link>
          <Link
            to="/agenda"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-gold hover:border-gold/40 transition-colors"
          >
            <CalendarDays className="h-3.5 w-3.5" /> Agenda
          </Link>
        </div>
      </div>
    </Card>
  );
}
