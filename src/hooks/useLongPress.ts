import { useCallback, useRef } from "react";

interface LongPressOptions {
  onLongPress: () => void;
  onClick: () => void;
  delay?: number;
}

/**
 * A press that's short = onClick, held = onLongPress instead (never both).
 * Pointer-based so it works the same on touch and mouse. Long-press cancels
 * on movement/leave so an accidental hold that turns into a scroll doesn't
 * fire a peek.
 */
export function useLongPress({ onLongPress, onClick, delay = 500 }: LongPressOptions) {
  const timerRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    firedRef.current = false;
    clear();
    timerRef.current = window.setTimeout(() => {
      firedRef.current = true;
      onLongPress();
    }, delay);
  }, [clear, delay, onLongPress]);

  const handleClick = useCallback(() => {
    if (firedRef.current) {
      // The long-press already handled this interaction — swallow the click
      // that a pointer release also generates.
      firedRef.current = false;
      return;
    }
    onClick();
  }, [onClick]);

  return {
    onPointerDown: start,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClick: handleClick,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}
