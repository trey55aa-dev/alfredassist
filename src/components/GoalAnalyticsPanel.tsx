// Per-goal analytics: streak counter, 30-day heatmap, relapse log, quarterly pace.
import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Flame, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import type { Goal } from "@/lib/goals";
import {
  CalendarDay,
  StreakStats,
  computeStreakStats,
  deadlineQuarterLabel,
  daysToDeadline,
  getCompletionGrid,
  logRelapse,
  logStreakDay,
  requiredWeeklyRate,
  weeksToDeadline,
} from "@/lib/goalsAnalytics";

interface Props {
  goal: Goal;
  onChange: (patch: Partial<Goal>) => void;
}

/* ---- Quarter pace strip (metric goals) ---- */

function QuarterPaceStrip({ goal }: { goal: Goal }) {
  const qLabel = deadlineQuarterLabel(goal.deadline);
  const weeks = weeksToDeadline(goal.deadline);
  const rate = requiredWeeklyRate(goal);
  const days = daysToDeadline(goal.deadline);

  if (!qLabel) return null;

  return (
    <div className="mt-2 rounded-md border border-border/40 bg-background/30 px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-gold">
        {qLabel}
      </span>
      {days !== null && (
        <span className="font-mono text-[10px] text-muted-foreground">
          {days < 0
            ? "Deadline passed"
            : `${days} days left`}
        </span>
      )}
      {rate !== null && rate > 0 && (
        <span className="font-mono text-[10px] text-muted-foreground">
          Need{" "}
          <span className="text-foreground font-medium">
            {goal.unit === "$"
              ? `$${rate >= 100 ? Math.round(rate) : rate.toFixed(0)}`
              : `${Number.isInteger(rate) ? rate : rate.toFixed(1)} ${goal.unit ?? "units"}`}
          </span>{" "}
          / week ({weeks} weeks left)
        </span>
      )}
      {rate === 0 && (
        <span className="font-mono text-[10px] text-gold">Target reached ✓</span>
      )}
    </div>
  );
}

/* ---- Relapse form ---- */

function RelapseForm({ onSubmit, onCancel }: {
  onSubmit: (reason: string, avoidance: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [avoidance, setAvoidance] = useState("");

  return (
    <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 mt-2">
      <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-destructive">
        Log relapse
      </div>
      <Textarea
        placeholder="What happened?"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="text-xs bg-background/60 border-border min-h-[52px] resize-none"
      />
      <Textarea
        placeholder="How to avoid it next time?"
        value={avoidance}
        onChange={(e) => setAvoidance(e.target.value)}
        className="text-xs bg-background/60 border-border min-h-[52px] resize-none"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            if (!reason.trim()) return;
            onSubmit(reason.trim(), avoidance.trim());
          }}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs h-7"
        >
          Submit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="text-xs h-7 text-muted-foreground"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

/* ---- Day dot ---- */

function DayDot({ day }: { day: CalendarDay }) {
  const base = "h-5 w-5 rounded-sm text-[8px] flex items-center justify-center font-mono relative group";
  let bg = "bg-muted/30";
  let title = day.date;

  if (day.isFuture) {
    bg = "bg-transparent border border-dashed border-border/30";
  } else if (day.status === "done") {
    bg = "bg-emerald-500/70";
    title = `${day.date} ✓${day.time ? ` at ${day.time}` : ""}`;
  } else if (day.status === "relapse") {
    bg = "bg-destructive/60";
    title = `${day.date} — relapse`;
  }

  return (
    <div className={`${base} ${bg}`} title={title}>
      {day.isToday && (
        <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-gold" />
      )}
    </div>
  );
}

/* ---- Streak panel ---- */

function StreakPanel({ goal, onChange }: Props) {
  const [showRelapse, setShowRelapse] = useState(false);
  const [showRelapseHistory, setShowRelapseHistory] = useState(false);

  const stats: StreakStats = computeStreakStats(goal);
  const grid = getCompletionGrid(goal, 35);
  const qLabel = deadlineQuarterLabel(goal.deadline);
  const days = daysToDeadline(goal.deadline);
  const target = goal.target ?? 90;
  const todayStr = new Date().toISOString().slice(0, 10);

  const handleMarkDone = () => {
    const time = new Date().toTimeString().slice(0, 5);
    onChange(logStreakDay(goal, todayStr, time));
  };

  const handleRelapse = (reason: string, avoidance: string) => {
    const time = new Date().toTimeString().slice(0, 5);
    onChange(logRelapse(goal, todayStr, time, reason, avoidance));
    setShowRelapse(false);
  };

  const streakPct = Math.min(100, Math.round((stats.currentStreak / target) * 100));
  const relapses = goal.relapseLog ?? [];
  const todayEntry = (goal.dailyLog ?? {})[todayStr];
  const todayDone = todayEntry?.done === true;
  const todayRelapsed = relapses.some((r) => r.date === todayStr) || todayEntry?.done === false;

  return (
    <div className="mt-2 space-y-3">
      {/* Streak hero */}
      <div className="rounded-md border border-border/60 bg-background/30 p-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{stats.currentStreak > 0 ? "🔥" : "💤"}</span>
            <div>
              <div className="font-display text-3xl text-gold leading-none">
                Day {stats.currentStreak}
              </div>
              <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-muted-foreground mt-0.5">
                of {target} · {target - stats.currentStreak > 0 ? `${target - stats.currentStreak} to go` : "achieved!"}
              </div>
            </div>
          </div>
          <div className="text-right">
            {qLabel && (
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-gold">
                {qLabel}
              </div>
            )}
            {days !== null && (
              <div className="font-mono text-[9px] text-muted-foreground">
                {days < 0 ? "Deadline passed" : `${days}d to deadline`}
              </div>
            )}
            {!stats.isAchievable && days !== null && days > 0 && (
              <div className="font-mono text-[9px] text-destructive flex items-center gap-1 mt-0.5">
                <AlertTriangle className="h-2.5 w-2.5" />
                Not achievable by deadline
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <Progress value={streakPct} className="h-1.5" />
          <div className="flex justify-between mt-1 font-mono text-[9px] text-muted-foreground">
            <span>{stats.currentStreak} days</span>
            <span>Target: {target} days</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border/30 pt-2">
          {[
            { label: "Best", value: stats.bestStreak + "d" },
            { label: "Done", value: stats.totalDone },
            { label: "Missed", value: stats.totalMissed },
            { label: "Relapses", value: relapses.length },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-display text-xl text-foreground">{s.value}</div>
              <div className="font-mono text-[8px] tracking-[0.15em] uppercase text-muted-foreground">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 35-day heatmap (5 weeks) */}
      <div>
        <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-muted-foreground mb-1.5">
          Last 5 weeks
        </div>
        <div className="grid grid-cols-7 gap-1">
          {["S","M","T","W","T","F","S"].map((d, i) => (
            <div key={i} className="font-mono text-[8px] text-muted-foreground/60 text-center">
              {d}
            </div>
          ))}
          {grid.map((day) => (
            <DayDot key={day.date} day={day} />
          ))}
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm bg-emerald-500/70" />
            <span className="font-mono text-[8px] text-muted-foreground">Done</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm bg-destructive/60" />
            <span className="font-mono text-[8px] text-muted-foreground">Relapse</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm bg-muted/30" />
            <span className="font-mono text-[8px] text-muted-foreground">Not logged</span>
          </div>
          {stats.lastDone && (
            <span className="font-mono text-[8px] text-muted-foreground/60 ml-auto">
              Last done: {stats.lastDone}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {!goal.done && (
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={todayDone}
            onClick={handleMarkDone}
            className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            {todayDone ? `Done today (${todayEntry?.time ?? ""})` : "Mark today done"}
          </Button>
          <Button
            size="sm"
            disabled={todayRelapsed}
            variant="outline"
            onClick={() => setShowRelapse((s) => !s)}
            className="h-8 text-xs border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-40"
          >
            <Flame className="h-3.5 w-3.5 mr-1" />
            {todayRelapsed ? "Relapse logged" : "Log relapse"}
          </Button>
        </div>
      )}

      {/* Relapse form */}
      {showRelapse && (
        <RelapseForm
          onSubmit={handleRelapse}
          onCancel={() => setShowRelapse(false)}
        />
      )}

      {/* Relapse history */}
      {relapses.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowRelapseHistory((s) => !s)}
            className="flex items-center gap-1 font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground"
          >
            {showRelapseHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {relapses.length} relapse{relapses.length !== 1 ? "s" : ""} logged
          </button>
          {showRelapseHistory && (
            <div className="mt-2 space-y-2">
              {[...relapses].reverse().map((r, i) => (
                <div
                  key={i}
                  className="rounded-md border border-destructive/20 bg-destructive/5 p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[9px] tracking-wider text-destructive uppercase">
                      {r.date}{r.time ? ` · ${r.time}` : ""}
                    </span>
                    <span className="font-mono text-[8px] text-muted-foreground">
                      #{relapses.length - i}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    <span className="font-medium text-foreground">Why: </span>
                    {r.reason}
                  </div>
                  {r.avoidance && (
                    <div className="text-muted-foreground mt-1">
                      <span className="font-medium text-foreground">Avoid: </span>
                      {r.avoidance}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---- Main export ---- */

export function GoalAnalyticsPanel({ goal, onChange }: Props) {
  const isStreak = goal.goalType === "streak";
  const isMetric = typeof goal.target === "number" && goal.target > 0 && goal.deadline;

  if (isStreak) {
    return <StreakPanel goal={goal} onChange={onChange} />;
  }

  if (isMetric) {
    return <QuarterPaceStrip goal={goal} />;
  }

  // Just show the quarter label from deadline if no other analytics
  const qLabel = deadlineQuarterLabel(goal.deadline);
  if (!qLabel) return null;
  return (
    <div className="mt-2 font-mono text-[10px] tracking-[0.2em] uppercase text-gold/70">
      {qLabel}
    </div>
  );
}
