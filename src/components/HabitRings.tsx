// A Streaks-app-style "today" view: one ring per daily habit, filled when
// done. Purely additive — the existing list below still owns non-daily
// cadences and the tap-to-open calendar/stats. No red/broken state on a
// miss here on purpose: "today" is either done or not-done-yet, never a
// failure to visualize (grace before penalty).
//
// A long-press on a ring opens a Quick Look peek — streak, this week's
// completion, done-today — without leaving the page or opening the full
// detail sheet. A normal tap still just toggles the habit.
import { useState } from "react";
import { Flame, CalendarCheck } from "lucide-react";
import { ProgressRing } from "@/components/ProgressRing";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useLongPress } from "@/hooks/useLongPress";
import { currentStreakFor, isCompleteForPeriod, last7Periods, type Habit, type HabitLog } from "@/lib/habits";

// Deliberately excludes coral/red — that hue means "missed" everywhere else
// in Alfred, so it's reserved and never used for a habit's own color.
const RING_COLORS = [
  "hsl(42 55% 62%)",  // gold
  "hsl(175 55% 55%)", // teal
  "hsl(265 65% 68%)", // violet
  "hsl(200 75% 60%)", // sky
  "hsl(150 50% 55%)", // moss
  "hsl(330 55% 68%)", // rose
  "hsl(28 70% 60%)",  // amber
  "hsl(220 60% 68%)", // periwinkle
];

function colorForHabit(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return RING_COLORS[Math.abs(hash) % RING_COLORS.length];
}

function RingButton({
  habit,
  logs,
  onToggle,
}: {
  habit: Habit;
  logs: HabitLog[];
  onToggle: (habit: Habit) => void;
}) {
  const [peeking, setPeeking] = useState(false);
  const done = isCompleteForPeriod(habit, logs);
  const streak = currentStreakFor(habit, logs);
  const week = last7Periods(habit, logs);
  const weekDone = week.filter((p) => p.done).length;
  const color = colorForHabit(habit.id);

  const press = useLongPress({
    onLongPress: () => setPeeking(true),
    onClick: () => onToggle(habit),
  });

  return (
    <Popover open={peeking} onOpenChange={setPeeking}>
      <PopoverAnchor asChild>
        <button
          type="button"
          {...press}
          title={`${habit.title} — tap to ${done ? "undo" : "mark done"}, hold to peek`}
          className="flex flex-col items-center gap-1.5 w-16 active:scale-95 transition-transform select-none"
        >
          <ProgressRing
            pct={done ? 100 : 0}
            size={60}
            stroke={5}
            color={color}
            trackColor="hsl(220 25% 18%)"
            label={streak > 0 ? String(streak) : undefined}
          />
          <span className="font-mono text-[8px] tracking-wide uppercase text-muted-foreground/70 text-center leading-tight line-clamp-2">
            {habit.title}
          </span>
        </button>
      </PopoverAnchor>
      <PopoverContent className="w-56" onOpenAutoFocus={(e) => e.preventDefault()}>
        <p className="font-display text-base leading-tight mb-2">{habit.title}</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Flame className="h-3.5 w-3.5 text-gold shrink-0" />
            <span>
              <span className="text-foreground font-medium">{streak}</span>-day streak
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarCheck className="h-3.5 w-3.5 text-gold shrink-0" />
            <span>
              <span className="text-foreground font-medium">{weekDone}/7</span> done this week
            </span>
          </div>
        </div>
        <p className="mt-2 font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground/60">
          {done ? "Done today" : "Not done yet"}
        </p>
      </PopoverContent>
    </Popover>
  );
}

export function HabitRings({
  habits,
  logs,
  onToggle,
}: {
  habits: Habit[]; // pre-filtered to daily, non-archived
  logs: HabitLog[];
  onToggle: (habit: Habit) => void;
}) {
  if (habits.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-5 gap-y-4">
      {habits.map((h) => (
        <RingButton key={h.id} habit={h} logs={logs} onToggle={onToggle} />
      ))}
    </div>
  );
}
