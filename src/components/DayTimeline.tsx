import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  MapPin,
  Pencil,
  Play,
  Repeat,
  Timer as TimerIcon,
  Trash2,
} from "lucide-react";
import {
  AgendaEvent,
  durationMinutes,
  formatEventTime,
  sortByStart,
} from "@/lib/agenda";
import { carrySeverity, carrySeverityLabel } from "@/lib/carryOver";
import {
  averageActualForEvent,
  startTimer,
} from "@/lib/taskTimer";
import { useToast } from "@/hooks/use-toast";

interface Props {
  /** Events for the day (already filtered/sorted recommended). */
  events: AgendaEvent[];
  /** Live "now" — drives the moving line and current-event highlight. */
  now: Date;
  /** First hour shown in the grid (0-23). */
  dayStartHour?: number;
  /** Last hour shown in the grid (1-24, exclusive). */
  dayEndHour?: number;
  /** Pixels per hour. Bigger = more breathing room. */
  pxPerHour?: number;
  /** Auto-scroll the now-line into view on mount. */
  autoScroll?: boolean;

  onToggleComplete?: (id: string) => void;
  onEdit?: (id: string) => void;
  onRemove?: (id: string) => void;
}

interface PlacedEvent {
  event: AgendaEvent;
  /** Top px from grid origin. */
  top: number;
  /** Height px (clamped to a minimum readable size). */
  height: number;
  /** Column index for overlap packing. */
  column: number;
  /** Total columns in this event's overlap cluster. */
  columnsInCluster: number;
}

/**
 * Pack overlapping events into columns so they sit side-by-side
 * instead of covering each other. Greedy: walk events in start order,
 * place each in the leftmost column whose last event ended before this starts.
 * Reset clusters when a gap appears (no overlaps).
 */
function packEvents(
  events: AgendaEvent[],
  dayStartMin: number,
  pxPerMin: number,
): PlacedEvent[] {
  const sorted = [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  const placed: PlacedEvent[] = [];
  let clusterStart = 0;
  let columns: AgendaEvent[][] = [];

  const flushCluster = () => {
    const total = columns.length;
    for (let i = clusterStart; i < placed.length; i++) {
      placed[i].columnsInCluster = total;
    }
    columns = [];
    clusterStart = placed.length;
  };

  for (const ev of sorted) {
    const startMs = new Date(ev.start).getTime();
    const endMs = new Date(ev.end).getTime();
    const overlapsCluster = columns.some((col) =>
      col.some((existing) => new Date(existing.end).getTime() > startMs),
    );
    if (!overlapsCluster && columns.length > 0) flushCluster();

    let placedCol = -1;
    for (let i = 0; i < columns.length; i++) {
      const last = columns[i][columns[i].length - 1];
      if (new Date(last.end).getTime() <= startMs) {
        columns[i].push(ev);
        placedCol = i;
        break;
      }
    }
    if (placedCol === -1) {
      columns.push([ev]);
      placedCol = columns.length - 1;
    }

    const startMinFromOrigin =
      (startMs - new Date(ev.start).setHours(0, 0, 0, 0)) / 60_000;
    const top = (startMinFromOrigin - dayStartMin) * pxPerMin;
    const height = Math.max(28, ((endMs - startMs) / 60_000) * pxPerMin);
    placed.push({
      event: ev,
      top,
      height,
      column: placedCol,
      columnsInCluster: 1, // overwritten on flush
    });
  }
  flushCluster();
  return placed;
}

function formatHourLabel(h: number): string {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}

export function DayTimeline({
  events,
  now,
  dayStartHour = 6,
  dayEndHour = 23,
  pxPerHour = 64,
  autoScroll = true,
  onToggleComplete,
  onEdit,
  onRemove,
}: Props) {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleStartTimer = (event: AgendaEvent, mode: "stopwatch" | "countdown") => {
    startTimer({ event, mode });
    toast({
      title: mode === "countdown" ? "Countdown started" : "Stopwatch started",
      description: event.title,
    });
  };

  const dayStartMin = dayStartHour * 60;
  const dayEndMin = dayEndHour * 60;
  const pxPerMin = pxPerHour / 60;
  const gridHeight = (dayEndMin - dayStartMin) * pxPerMin;

  const allDay = useMemo(
    () => events.filter((e) => e.allDay),
    [events],
  );
  const timed = useMemo(
    () => sortByStart(events.filter((e) => !e.allDay)),
    [events],
  );

  const placed = useMemo(
    () => packEvents(timed, dayStartMin, pxPerMin),
    [timed, dayStartMin, pxPerMin],
  );

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isNowInView =
    nowMinutes >= dayStartMin && nowMinutes <= dayEndMin;
  const nowTop = (nowMinutes - dayStartMin) * pxPerMin;

  useEffect(() => {
    if (!autoScroll || !containerRef.current || !isNowInView) return;
    const offset = Math.max(0, nowTop - 120);
    containerRef.current.scrollTo({ top: offset, behavior: "smooth" });
    // Only on mount — don't re-scroll every minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hours: number[] = [];
  for (let h = dayStartHour; h <= dayEndHour; h++) hours.push(h);

  return (
    <div className="space-y-3">
      {allDay.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allDay.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onToggleComplete?.(e.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-all ${
                e.completed
                  ? "border-gold/30 bg-background/30 text-muted-foreground line-through"
                  : "border-gold/40 bg-background/50 text-foreground hover:border-gold/70"
              }`}
            >
              <span aria-hidden>{e.emoji ?? "📌"}</span>
              <span className="font-mono text-[10px] tracking-[0.15em] uppercase">
                All day
              </span>
              <span className="font-display">{e.title}</span>
            </button>
          ))}
        </div>
      )}

      <div
        ref={containerRef}
        className="relative max-h-[calc(100vh-22rem)] overflow-y-auto rounded-md border border-border/60 bg-background/30"
      >
        <div
          className="relative pl-16 pr-3"
          style={{ height: `${gridHeight}px` }}
        >
          {/* Hour grid lines + labels */}
          {hours.map((h) => {
            const top = (h * 60 - dayStartMin) * pxPerMin;
            return (
              <div key={h}>
                <div
                  className="absolute left-0 w-14 -translate-y-2 text-right pr-2 font-mono text-[10px] tracking-wider text-muted-foreground/70"
                  style={{ top: `${top}px` }}
                >
                  {formatHourLabel(h)}
                </div>
                <div
                  className="absolute left-14 right-0 border-t border-border/40"
                  style={{ top: `${top}px` }}
                />
                {/* Half-hour subtle line */}
                {h < dayEndHour && (
                  <div
                    className="absolute left-14 right-0 border-t border-dashed border-border/15"
                    style={{ top: `${top + 30 * pxPerMin}px` }}
                  />
                )}
              </div>
            );
          })}

          {/* Now line */}
          {isNowInView && (
            <div
              className="absolute left-14 right-0 z-20 pointer-events-none"
              style={{ top: `${nowTop}px` }}
              aria-hidden
            >
              <div className="relative">
                <div className="h-px w-full bg-gold/80 shadow-[0_0_8px_rgba(212,175,55,0.6)]" />
                <div className="absolute -left-2 -top-1 h-2 w-2 rounded-full bg-gold shadow-[0_0_6px_rgba(212,175,55,0.8)]" />
                <div className="absolute -top-2 right-2 font-mono text-[9px] tracking-[0.25em] uppercase text-gold">
                  {now.toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Events */}
          {placed.map((p) => {
            const startMs = new Date(p.event.start).getTime();
            const endMs = new Date(p.event.end).getTime();
            const isCurrent = startMs <= now.getTime() && now.getTime() < endMs;
            const isPast = endMs <= now.getTime();
            const isExpanded = expandedId === p.event.id;
            const colWidth = `calc((100% - 0.75rem) / ${p.columnsInCluster})`;
            const colLeft = `calc((100% - 0.75rem) / ${p.columnsInCluster} * ${p.column})`;
            const sev = carrySeverity(p.event);
            const carriedAccent =
              sev === "alarm"
                ? "hsl(0 75% 55%)"
                : sev === "warn"
                  ? "hsl(20 85% 55%)"
                  : sev === "nudge"
                    ? "hsl(40 85% 55%)"
                    : null;
            const accent =
              carriedAccent ??
              p.event.calendarColor ??
              (isCurrent
                ? "hsl(var(--primary))"
                : "hsl(var(--muted-foreground))");
            const isShort = p.height < 56;
            const carryLabel = carrySeverityLabel(sev);

            return (
              <div
                key={p.event.id}
                className="absolute z-10"
                style={{
                  top: `${p.top}px`,
                  height: `${p.height}px`,
                  left: `calc(0.5rem + ${colLeft})`,
                  width: colWidth,
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : p.event.id)
                  }
                  className={`group relative h-full w-full overflow-hidden rounded-md border-l-4 px-3 py-2 text-left transition-all ${
                    p.event.completed
                      ? "bg-background/40 opacity-60"
                      : isCurrent
                        ? "bg-background/80 shadow-gold ring-1 ring-gold/40"
                        : isPast
                          ? "bg-background/40 hover:bg-background/55"
                          : "bg-background/60 hover:bg-background/80"
                  }`}
                  style={{
                    borderLeftColor: accent,
                    backgroundImage: p.event.completed
                      ? undefined
                      : `linear-gradient(90deg, color-mix(in srgb, ${accent} 18%, transparent), transparent 60%)`,
                  }}
                  aria-expanded={isExpanded}
                >
                  <div
                    className={`flex items-start gap-2 ${
                      isShort ? "h-full items-center" : ""
                    }`}
                  >
                    <span
                      className={`shrink-0 ${
                        isShort ? "text-base" : "text-2xl"
                      }`}
                      aria-hidden
                    >
                      {p.event.emoji ?? "•"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div
                        className={`font-display leading-tight line-clamp-1 ${
                          isShort ? "text-xs" : "text-sm"
                        } ${
                          p.event.completed
                            ? "text-muted-foreground line-through"
                            : "text-foreground"
                        }`}
                      >
                        {p.event.title}
                      </div>
                      {!isShort && (
                        <div className="mt-0.5 font-mono text-[10px] tracking-wider text-muted-foreground">
                          {formatEventTime(p.event)} ·{" "}
                          {durationMinutes(p.event)} min
                          {carryLabel && (
                            <span
                              className={`ml-2 font-mono text-[9px] tracking-[0.2em] uppercase ${
                                sev === "alarm"
                                  ? "text-destructive font-bold"
                                  : sev === "warn"
                                    ? "text-orange-400"
                                    : "text-gold"
                              }`}
                            >
                              · {carryLabel}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {p.event.completed && (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-gold/80" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div
                    className="absolute left-0 right-0 z-30 mt-1 rounded-md border border-gold/40 bg-popover p-3 shadow-xl"
                    style={{ top: `${p.height}px` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-display text-base">
                          <span aria-hidden>{p.event.emoji ?? "•"}</span>
                          {p.event.title}
                        </div>
                        <div className="mt-1 font-mono text-[10px] tracking-wider text-muted-foreground">
                          {formatEventTime(p.event)} ·{" "}
                          {durationMinutes(p.event)} min
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleComplete?.(p.event.id);
                        }}
                        className="text-muted-foreground hover:text-gold"
                        aria-label={
                          p.event.completed
                            ? "Mark incomplete"
                            : "Mark complete"
                        }
                      >
                        {p.event.completed ? (
                          <CheckCircle2 className="h-5 w-5 text-gold" />
                        ) : (
                          <Circle className="h-5 w-5" />
                        )}
                      </button>
                    </div>

                    {p.event.location && (
                      <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {p.event.location}
                      </div>
                    )}
                    {p.event.description && (
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-3">
                        {p.event.description}
                      </p>
                    )}

                    <div className="mt-3 border-t border-border/40 pt-2 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">
                          Timer
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartTimer(p.event, "countdown");
                          }}
                          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-gold"
                          title={`Countdown ${
                            p.event.estimatedMinutes ?? durationMinutes(p.event)
                          } min`}
                        >
                          <TimerIcon className="h-3 w-3" />
                          Countdown ·{" "}
                          {p.event.estimatedMinutes ?? durationMinutes(p.event)} min
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartTimer(p.event, "stopwatch");
                          }}
                          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-gold"
                        >
                          <Play className="h-3 w-3" />
                          Stopwatch
                        </button>
                        {(() => {
                          const avg = averageActualForEvent(p.event.id);
                          return avg ? (
                            <span className="font-mono text-[9px] tracking-wider text-muted-foreground/70">
                              · avg {avg.avgMinutes.toFixed(1)} min over{" "}
                              {avg.sessions} session{avg.sessions === 1 ? "" : "s"}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    </div>

                    {p.event.source === "recurring" ? (
                      <div className="mt-1 flex items-center gap-2 border-t border-border/40 pt-2">
                        <a
                          href="/schedule"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-gold"
                        >
                          <Repeat className="h-3 w-3" /> Manage routine
                        </a>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemove?.(p.event.id);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" /> Skip today
                        </button>
                      </div>
                    ) : (p.event.source === "manual" ||
                      p.event.source === "google" ||
                      p.event.source === "outlook") && (
                      <div className="mt-1 flex items-center gap-2 border-t border-border/40 pt-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedId(null);
                            onEdit?.(p.event.id);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-gold"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemove?.(p.event.id);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" /> Remove
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {timed.length === 0 && allDay.length === 0 && (
            <div className="absolute inset-x-0 top-1/3 flex flex-col items-center gap-2 text-center">
              <Clock className="h-6 w-6 text-gold/60" />
              <p className="font-display italic text-muted-foreground">
                "Empty hours, sir. The day is yours to shape."
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
