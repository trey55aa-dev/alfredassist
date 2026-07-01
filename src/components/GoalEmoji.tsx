import { useEffect, useRef } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  type Goal,
  type GoalCategory,
  goalEmoji,
  goalEmojiDelayMs,
  GOAL_EMOJIS,
  CATEGORY_DEFAULT_EMOJI,
} from "@/lib/goals";

/** Animated goal emoji — gentle idle float (desynced per goal) + a celebratory
 *  pop when the goal flips to done. */
export function GoalEmoji({
  goal,
  className = "",
  style,
}: {
  goal: Pick<Goal, "emoji" | "category" | "id" | "done">;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevDone = useRef(goal.done);

  useEffect(() => {
    if (goal.done && !prevDone.current && ref.current) {
      const el = ref.current;
      el.classList.add("goal-emoji-pop");
      const t = setTimeout(() => el.classList.remove("goal-emoji-pop"), 600);
      prevDone.current = goal.done;
      return () => clearTimeout(t);
    }
    prevDone.current = goal.done;
  }, [goal.done]);

  return (
    <span
      ref={ref}
      className={`goal-emoji ${className}`}
      style={{ animationDelay: `${goalEmojiDelayMs(goal.id)}ms`, ...style }}
      aria-hidden
    >
      {goalEmoji(goal)}
    </span>
  );
}

/** Popover grid for choosing a goal's emoji. Shows the category default until
 *  the user picks one. */
export function GoalEmojiPicker({
  value,
  category,
  onChange,
}: {
  value?: string;
  category: GoalCategory;
  onChange: (emoji: string) => void;
}) {
  const current = value || CATEGORY_DEFAULT_EMOJI[category] || "🎯";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Pick an emoji for this goal"
          className="h-10 w-10 shrink-0 rounded-lg border border-border bg-background/40 flex items-center justify-center text-xl hover:border-gold/40 transition-colors"
        >
          {current}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 bg-popover border-border" align="start">
        <div className="grid grid-cols-8 gap-1 max-h-52 overflow-y-auto scrollbar-thin">
          {GOAL_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onChange(e)}
              className={`h-7 w-7 rounded-md flex items-center justify-center text-lg hover:bg-gold/15 transition-colors ${
                value === e ? "bg-gold/20 ring-1 ring-gold/40" : ""
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
