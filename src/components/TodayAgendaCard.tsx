import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, Clock, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  AgendaEvent,
  currentEvent,
  filterToDay,
  formatEventTime,
  getTodayEvents,
  nextEvent,
  sortByStart,
} from "@/lib/agenda";

interface Props {
  /** Optional pre-loaded events; otherwise the card fetches on mount. */
  events?: AgendaEvent[];
  /** Max events shown in the card body. */
  limit?: number;
}

export function TodayAgendaCard({ events: initial, limit = 3 }: Props) {
  const [events, setEvents] = useState<AgendaEvent[] | null>(initial ?? null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (initial) return;
    let alive = true;
    getTodayEvents().then((data) => {
      if (alive) setEvents(data);
    });
    return () => {
      alive = false;
    };
  }, [initial]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const today = useMemo(
    () => (events ? sortByStart(filterToDay(events, now)) : []),
    [events, now],
  );
  const ongoing = useMemo(() => currentEvent(today, now), [today, now]);
  const upcoming = useMemo(() => nextEvent(today, now), [today, now]);
  const visible = today.slice(0, limit);
  const overflow = Math.max(0, today.length - visible.length);
  const loading = events === null;

  return (
    <Card className="p-6 bg-gradient-card border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-gold" />
          <div>
            <h3 className="font-display text-2xl">Today's Agenda</h3>
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mt-0.5">
              {loading
                ? "Reviewing the day"
                : today.length === 0
                  ? "Diary is clear"
                  : `${today.length} engagement${today.length === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>
        <Link
          to="/agenda"
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] text-gold hover:text-gold-soft"
        >
          Open <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Now / next strip */}
      {(ongoing || upcoming) && (
        <div className="mb-4 rounded-md border border-gold/30 bg-background/50 p-3">
          <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-gold mb-1">
            {ongoing ? "Happening now" : "Up next"}
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <div className="font-display text-lg text-foreground line-clamp-1">
              {(ongoing ?? upcoming)!.title}
            </div>
            <div className="font-mono text-[10px] tracking-wider text-muted-foreground whitespace-nowrap">
              {formatEventTime((ongoing ?? upcoming)!)}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded-md bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/60 p-5 text-center">
          <p className="font-display italic text-muted-foreground text-sm">
            "A perfectly empty diary, sir. The day is yours to shape."
          </p>
          <Link
            to="/agenda"
            className="mt-3 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] text-gold hover:text-gold-soft"
          >
            Connect a calendar <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((e) => (
            <li
              key={e.id}
              className="group flex items-start gap-3 rounded-md border border-border/60 bg-background/40 p-3 hover:border-gold/40 transition-all"
            >
              <div
                className="mt-1 h-8 w-1 rounded-full flex-shrink-0"
                style={{
                  background:
                    e.calendarColor ?? "hsl(var(--primary))",
                }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm text-foreground group-hover:text-gold transition-colors line-clamp-1">
                  {e.title}
                </div>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatEventTime(e)}
                  </span>
                  {e.location && (
                    <span className="inline-flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{e.location}</span>
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {overflow > 0 && (
        <Link
          to="/agenda"
          className="mt-3 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] text-gold hover:text-gold-soft"
        >
          +{overflow} more <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </Card>
  );
}
