import { LifeBuoy, Flame, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CADENCE_NOUN,
  Recovery,
} from "@/lib/habits";

interface Props {
  recoveries: Recovery[];
  onMarkDone: (habitId: string) => void;
  compact?: boolean;
  limit?: number;
}

/**
 * "Get Back on Track" — appears whenever any habit's current period is incomplete.
 * Compact variant is used on the Dashboard.
 */
export function RecoveryPanel({ recoveries, onMarkDone, compact, limit }: Props) {
  if (recoveries.length === 0) {
    if (compact) return null;
    return (
      <Card className="p-6 bg-gradient-card border-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-gold/15 flex items-center justify-center">
            <Flame className="h-5 w-5 text-gold" />
          </div>
          <div>
            <h3 className="font-display text-2xl">All habits in formation</h3>
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mt-0.5">
              Nothing requires recovery, sir.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const list = limit ? recoveries.slice(0, limit) : recoveries;

  return (
    <Card className="p-6 bg-gradient-card border-border border-l-2 border-l-gold/60">
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-gold/15 flex items-center justify-center">
            <LifeBuoy className="h-5 w-5 text-gold" />
          </div>
          <div>
            <h3 className="font-display text-2xl">
              {compact ? "Habits at risk" : "Get Back on Track"}
            </h3>
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mt-0.5">
              {recoveries.length} habit{recoveries.length === 1 ? "" : "s"} need attention
            </p>
          </div>
        </div>
      </div>

      <ul className={compact ? "space-y-2" : "space-y-5"}>
        {list.map((r) => (
          <li
            key={r.habit.id}
            className="rounded-md bg-background/40 border border-border/60 p-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0 sm:flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-foreground font-medium">{r.habit.title}</span>
                  <span className="px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-[0.15em] bg-muted/40 text-muted-foreground border-border">
                    {r.habit.cadence}
                  </span>
                  <span className="font-mono text-[10px] tracking-wider uppercase text-gold">
                    {r.missedPeriods} {CADENCE_NOUN[r.habit.cadence]}
                    {r.missedPeriods === 1 ? "" : "s"} missed
                  </span>
                </div>
                {!compact && (
                  <p className="mt-2 font-display italic text-sm text-muted-foreground leading-snug">
                    {r.flavor}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => onMarkDone(r.habit.id)}
                className="bg-gold text-primary-foreground hover:bg-gold-soft flex-shrink-0"
              >
                Start fresh today <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>

            {!compact && (
              <ol className="mt-3 space-y-1.5 pl-1">
                {r.steps.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-2 leading-relaxed">
                    <span className="font-mono text-gold/70 flex-shrink-0">{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
