import { useEffect, useState } from "react";
import {
  DEFAULT_FOCUS_STATE,
  FOCUS_MODE_CHANGED,
  FocusModeState,
  getFocusState,
} from "@/lib/focusMode";

/** Reactive subscriber to localStorage-backed focus mode state. */
export function useFocusMode(): FocusModeState {
  const [state, setState] = useState<FocusModeState>(
    typeof window === "undefined" ? DEFAULT_FOCUS_STATE : getFocusState(),
  );

  useEffect(() => {
    const sync = () => setState(getFocusState());
    sync();
    window.addEventListener(FOCUS_MODE_CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(FOCUS_MODE_CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return state;
}
