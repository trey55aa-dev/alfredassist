import { Compass, ArrowRight, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CADENCE_NOUN } from "@/lib/habits";
import { progressPct } from "@/lib/goals";
import { GoalEmoji } from "@/components/GoalEmoji";
import type { TodayFocusPick } from "@/lib/priorities";

function fmtGoalVal(n: number, unit: string | undefined): string {
  if (!isFinite(n) || n === 0) return "—";
  const isMonetary = unit === "$" || unit?.toLowerCase() === "usd";
  if (isMonetary) return `$${Math.round(n).toLocaleString()}`;
  const str = n >= 10 ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, "");
  return unit ? `${str} ${unit}` : str;
}

interface Props {
  pick: TodayFocusPick | null;
  onMarkHabitDone: (habitId: string) => void;
  onQuickLogGoal: (goalId: string, delta: number) => void;
}

/**
 * Alfred's single top pick across goals and habits — the answer to
 * "what should I actually do first?" See src/lib/priorities.ts for the
 * (deterministic, no-AI) ranking.
 */
export function TodayFocusCard({ pick, onMarkHabitDone, onQuickLogGoal }: Props) {
  if (!pick) {
    return (
      <Card className="p-5 bg-gradient-card border-border border-l-2 border-l-teal/60">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-teal/15 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-4.5 w-4.5 text-teal" />
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-teal mb-0.5">
              Do this first
            </p>
            <p className="text-sm text-foreground">Nothing urgent, sir — you're on top of it.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 bg-gradient-card border-border border-l-2 border-l-gold/60">
      <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] uppercase text-gold mb-3">
        <Compass className="h-3.5 w-3.5" />
        Do this first
      </p>

      {pick.kind === "habit" ? (
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground">{pick.recovery.habit.title}</span>
              <span className="px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-[0.15em] bg-muted/40 text-muted-foreground border-border">
                {pick.recovery.habit.cadence}
              </span>
              <span className="font-mono text-[10px] tracking-wider uppercase text-gold">
                {pick.recovery.missedPeriods} {CADENCE_NOUN[pick.recovery.habit.cadence]}
                {pick.recovery.missedPeriods === 1 ? "" : "s"} missed
              </span>
            </div>
            <p className="mt-2 font-display italic text-sm text-muted-foreground leading-snug">
              {pick.recovery.flavor}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => onMarkHabitDone(pick.recovery.habit.id)}
            className="bg-gold text-primary-foreground hover:bg-gold-soft flex-shrink-0"
          >
            {pick.recovery.missedPeriods > 1 ? "Start fresh today" : "Mark done"}
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <GoalEmoji goal={pick.goal} className="text-base" />
              <span className="text-sm font-medium text-foreground">{pick.goal.title}</span>
              <span className={`font-mono text-[9px] tracking-[0.2em] uppercase ${pick.projection.tone}`}>
                {pick.projection.label}
              </span>
            </div>
            {pick.projection.detail && (
              <p className="mt-2 text-xs text-muted-foreground leading-snug max-w-md">
                {pick.projection.detail}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2 max-w-xs">
              <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-gold transition-all duration-700"
                  style={{ width: `${progressPct(pick.goal)}%` }}
                />
              </div>
              <span className="font-mono text-[9px] text-muted-foreground/60 shrink-0 tabular-nums">
                {fmtGoalVal(pick.goal.current ?? 0, pick.goal.unit)} / {fmtGoalVal(pick.goal.target ?? 0, pick.goal.unit)}
              </span>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() =>
              onQuickLogGoal(pick.goal.id, Math.round(pick.projection.requiredDailyRate ?? 0) || 1)
            }
            className="bg-gold text-primary-foreground hover:bg-gold-soft flex-shrink-0"
          >
            Log progress <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      )}
    </Card>
  );
}
