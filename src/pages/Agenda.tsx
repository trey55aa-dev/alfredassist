import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, MapPin, Plug, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QuickAddEvent } from "@/components/QuickAddEvent";
import { useToast } from "@/hooks/use-toast";
import {
  AgendaEvent,
  currentEvent,
  filterToDay,
  formatEventTime,
  getTodayEvents,
  nextEvent,
  sortByStart,
} from "@/lib/agenda";
import { LOCAL_EVENTS_CHANGED, removeLocalEvent } from "@/lib/agendaStore";
import { formatLongDate } from "@/lib/alfred";

export default function Agenda() {
  const { toast } = useToast();
  const [events, setEvents] = useState<AgendaEvent[] | null>(null);
  const [now, setNow] = useState(new Date());

  const refresh = useCallback(() => {
    getTodayEvents().then(setEvents);
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(LOCAL_EVENTS_CHANGED, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(LOCAL_EVENTS_CHANGED, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

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
  const loading = events === null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={formatLongDate(now)}
        title="Agenda"
        description="Today's engagements at a glance — Alfred will plan focus blocks around them."
      />

      {/* Hero — current / next */}
      {(ongoing || upcoming) && (
        <Card className="p-6 bg-gradient-card border-border">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-gold mb-1">
                {ongoing ? "Happening now" : "Up next"}
              </div>
              <h2 className="font-display text-3xl text-foreground line-clamp-2">
                {(ongoing ?? upcoming)!.title}
              </h2>
              <div className="mt-2 flex items-center gap-4 text-xs font-mono text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatEventTime((ongoing ?? upcoming)!)}
                </span>
                {(ongoing ?? upcoming)!.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {(ongoing ?? upcoming)!.location}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Quick add */}
      <QuickAddEvent />

      {/* Day timeline */}
      <Card className="p-6 bg-gradient-card border-border">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-2xl">Today</h3>
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
            {loading ? "Loading" : `${today.length} event${today.length === 1 ? "" : "s"}`}
          </span>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-md bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : today.length === 0 ? (
          <EmptyState />
        ) : (
          <ol className="relative border-l border-border/60 pl-5 space-y-4">
            {today.map((e) => {
              const isNow = ongoing?.id === e.id;
              return (
                <li key={e.id} className="relative">
                  <span
                    className={`absolute -left-[27px] top-2 h-3 w-3 rounded-full border-2 ${
                      isNow
                        ? "bg-gold border-gold shadow-gold animate-pulse"
                        : "bg-background border-border"
                    }`}
                    aria-hidden
                  />
                  <div
                    className={`rounded-md border p-4 transition-all ${
                      isNow
                        ? "border-gold/50 bg-background/60"
                        : "border-border/60 bg-background/40 hover:border-gold/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="font-display text-lg text-foreground line-clamp-1">
                          {e.title}
                        </div>
                        {e.calendarName && (
                          <div className="mt-0.5 font-mono text-[9px] tracking-[0.25em] uppercase text-muted-foreground/70">
                            {e.calendarName}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] tracking-wider text-gold whitespace-nowrap">
                          {formatEventTime(e)}
                        </span>
                        {e.source === "manual" && (
                          <button
                            type="button"
                            onClick={() => {
                              removeLocalEvent(e.id);
                              toast({
                                title: "Event removed",
                                description: e.title,
                              });
                            }}
                            className="text-muted-foreground/60 hover:text-destructive transition-colors p-1"
                            aria-label={`Remove ${e.title}`}
                            title="Remove event"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    {(e.location || e.description) && (
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {e.location && (
                          <div className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3 w-3" />
                            {e.location}
                          </div>
                        )}
                        {e.description && (
                          <p className="line-clamp-2">{e.description}</p>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-md border border-dashed border-border/60 p-8 text-center space-y-3">
      <div className="mx-auto h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center">
        <Plug className="h-5 w-5 text-gold" />
      </div>
      <div>
        <p className="font-display italic text-foreground">
          "A perfectly empty diary, sir."
        </p>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Add an event with Quick Add above, or connect Google Calendar to
          import your existing engagements.
        </p>
      </div>
      <p className="font-mono text-[9px] tracking-[0.25em] uppercase text-muted-foreground/60">
        Google Calendar sync · coming next
      </p>
    </div>
  );
}
