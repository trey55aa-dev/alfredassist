// A Streaks-app-style "today" view: one ring per daily habit, filled when
// done. Purely additive — the existing list below still owns non-daily
// cadences and the tap-to-open calendar/stats. No red/broken state on a
// miss here on purpose: "today" is either done or not-done-yet, never a
// failure to visualize (grace before penalty).
import { ProgressRing } from "@/components/ProgressRing";
import { currentStreakFor, isCompleteForPeriod, type Habit, type HabitLog } from "@/lib/habits";

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
      {habits.map((h) => {
        const done = isCompleteForPeriod(h, logs);
        const streak = currentStreakFor(h, logs);
        const color = colorForHabit(h.id);
        return (
          <button
            key={h.id}
            type="button"
            onClick={() => onToggle(h)}
            title={`${h.title} — tap to ${done ? "undo" : "mark done"}`}
            className="flex flex-col items-center gap-1.5 w-16 active:scale-95 transition-transform"
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
              {h.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}
