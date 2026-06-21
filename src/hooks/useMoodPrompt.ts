import { useEffect, useState } from "react";
import { type CheckInType, hasTodayCheckIn, MOOD_CHANGED } from "@/lib/mood";

type PromptState = { type: CheckInType } | null;

/** Returns which check-in (morning / evening) is currently due, or null. */
export function useMoodPrompt(): [PromptState, () => void] {
  const [prompt, setPrompt] = useState<PromptState>(null);
  const [dismissed, setDismissed] = useState<Set<CheckInType>>(new Set());

  const check = () => {
    const hour = new Date().getHours();
    const morning = hour >= 6  && hour < 11;
    const evening = hour >= 19 && hour < 23;

    if (morning && !hasTodayCheckIn("morning") && !dismissed.has("morning")) {
      setPrompt({ type: "morning" });
    } else if (evening && !hasTodayCheckIn("evening") && !dismissed.has("evening")) {
      setPrompt({ type: "evening" });
    } else {
      setPrompt(null);
    }
  };

  useEffect(() => {
    check();
    const id = window.setInterval(check, 5 * 60 * 1000);
    window.addEventListener(MOOD_CHANGED, check);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(MOOD_CHANGED, check);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissed]);

  const dismiss = () => {
    if (prompt) {
      setDismissed((p) => new Set([...p, prompt.type]));
      setPrompt(null);
    }
  };

  return [prompt, dismiss];
}
