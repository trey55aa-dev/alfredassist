// The step list inside a routine habit — shown on the Dashboard, Today and the
// Habits page so the same routine behaves the same wherever you meet it.
//
// Collapsed by default: a routine is one line until you want the detail, which
// keeps simple mode simple. Ticking the last step completes the habit; ticking
// the habit itself fills the list in (see lib/habitSteps).

import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Circle } from "lucide-react";
import type { Habit } from "@/lib/habits";
import {
  HABIT_STEPS_CHANGED,
  loadStepTicks,
  stepProgress,
  stepsOf,
  ticksFor,
  toggleStep,
  type StepTicks,
} from "@/lib/habitSteps";
import { todayKey } from "@/lib/alfred";

/** Live view of the step store, refreshed whenever any surface writes to it. */
export function useStepTicks(): StepTicks {
  const [ticks, setTicks] = useState<StepTicks>(() => loadStepTicks());
  useEffect(() => {
    const refresh = () => setTicks(loadStepTicks());
    window.addEventListener(HABIT_STEPS_CHANGED, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener(`alfred.ls:${"alfred.habitStepTicks"}`, refresh);
    return () => {
      window.removeEventListener(HABIT_STEPS_CHANGED, refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(`alfred.ls:${"alfred.habitStepTicks"}`, refresh);
    };
  }, []);
  return ticks;
}

export function HabitStepList({
  habit,
  habitDone,
  onHabitShouldToggle,
  date = todayKey(),
  defaultOpen = false,
}: {
  habit: Habit;
  /** Whether the parent habit is currently ticked for this period. */
  habitDone: boolean;
  /** Called when finishing (or reopening) the list should flip the habit. */
  onHabitShouldToggle: () => void;
  date?: string;
  defaultOpen?: boolean;
}) {
  const ticks = useStepTicks();
  const steps = stepsOf(habit);
  const [open, setOpen] = useState(defaultOpen);

  if (steps.length === 0) return null;

  const progress = stepProgress(habit, ticks, date);
  const ticked = new Set(ticksFor(ticks, habit.id, date));

  const handleStep = (stepId: string) => {
    const result = toggleStep(habit, stepId, habitDone, date);
    // Finishing the list completes the habit; taking a step back off a finished
    // routine reopens it, so the tick never claims more than the list does.
    if (result.habitShouldComplete || result.habitShouldReopen) onHabitShouldToggle();
  };

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground/70 hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {progress.done}/{progress.total} steps
      </button>

      {open && (
        <ul className="mt-1.5 space-y-1 pl-1 border-l border-border/40">
          {steps.map((s) => {
            const done = ticked.has(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => handleStep(s.id)}
                  aria-pressed={done}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-background/40 transition-colors"
                >
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal shrink-0" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  )}
                  <span className={done ? "text-muted-foreground line-through" : "text-foreground"}>
                    {s.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
