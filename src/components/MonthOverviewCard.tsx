import { CalendarRange } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { DayTone, MonthDayStatus } from "@/lib/monthOverview";

const TONE_BG: Record<DayTone, string> = {
  ahead: "bg-gold",
  on_pace: "bg-teal",
  behind: "bg-orange-400",
  behind_critical: "bg-destructive",
  no_data: "bg-muted/40",
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const LEGEND: { tone: DayTone; label: string }[] = [
  { tone: "ahead", label: "Ahead" },
  { tone: "on_pace", label: "On pace" },
  { tone: "behind", label: "Behind" },
  { tone: "behind_critical", label: "Well behind" },
  { tone: "no_data", label: "No data" },
];

/**
 * "This Month" — one glanceable color per day across every habit and goal.
 * Past days are graded on what happened; future days (lighter, dashed) are
 * graded on a pace projection. See src/lib/monthOverview.ts for the logic
 * and the deliberate scope limit (future coloring is goal-pace only, never
 * a fabricated habit forecast).
 */
export function MonthOverviewCard({ days }: { days: MonthDayStatus[] }) {
  const monthLabel = days.find((d) => d.inMonth)?.date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <Card className="p-5 bg-gradient-card border-border border-l-2 border-l-teal/60">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-md bg-teal/15 flex items-center justify-center shrink-0">
          <CalendarRange className="h-4.5 w-4.5 text-teal" />
        </div>
        <div>
          <h3 className="font-display text-xl">This Month</h3>
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mt-0.5">
            {monthLabel}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d, i) => (
          <div
            key={i}
            className="text-center font-mono text-[9px] tracking-wider uppercase text-muted-foreground/50"
          >
            {d}
          </div>
        ))}
        {days.map((day) => {
          const opacity = !day.inMonth ? "opacity-20" : day.isFuture ? "opacity-50" : "opacity-100";
          const border = day.isFuture && day.inMonth ? "border border-dashed border-foreground/25" : "";
          const ring = day.isToday ? "ring-2 ring-gold ring-offset-1 ring-offset-background" : "";
          const title = day.ymd + (day.reason ? ` · ${day.reason}` : " · no data");
          return (
            <div
              key={day.ymd}
              title={title}
              className={`aspect-square rounded-md flex items-center justify-center font-mono text-[9px] text-foreground/70 ${TONE_BG[day.tone]} ${opacity} ${border} ${ring}`}
            >
              {day.date.getDate()}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-center gap-3 flex-wrap font-mono text-[9px] tracking-wider uppercase text-muted-foreground/60">
        {LEGEND.map(({ tone, label }) => (
          <span key={tone} className="inline-flex items-center gap-1">
            <span className={`h-2.5 w-2.5 rounded-full inline-block ${TONE_BG[tone]}`} />
            {label}
          </span>
        ))}
        <span className="text-muted-foreground/40">· dashed = projected</span>
      </div>
    </Card>
  );
}
