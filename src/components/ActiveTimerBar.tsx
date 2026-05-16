import { useEffect, useState } from "react";
import { Pause, Play, Square, Timer as TimerIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  ActiveTimer,
  TIMER_CHANGED,
  elapsedSeconds,
  formatTimerDisplay,
  getActiveTimer,
  pauseTimer,
  remainingSeconds,
  resumeTimer,
  stopTimer,
} from "@/lib/taskTimer";

/**
 * Floating bar pinned to the bottom of the viewport whenever a task timer is active.
 * Visible across every page since it lives in AppLayout.
 */
export function ActiveTimerBar() {
  const { toast } = useToast();
  const [timer, setTimer] = useState<ActiveTimer | null>(getActiveTimer());
  const [, setTick] = useState(0);

  useEffect(() => {
    const onChange = () => setTimer(getActiveTimer());
    window.addEventListener(TIMER_CHANGED, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(TIMER_CHANGED, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  // 1Hz tick while a timer exists
  useEffect(() => {
    if (!timer) return;
    const i = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(i);
  }, [timer]);

  // Notify when a countdown hits zero
  useEffect(() => {
    if (!timer || timer.mode !== "countdown") return;
    const remaining = remainingSeconds(timer);
    if (remaining > 0) return;
    if (remaining > -2) {
      // Just crossed zero
      toast({
        title: "Estimate reached",
        description: `${timer.eventTitle} — keep going or wrap up.`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer && timer.runningSince ? Math.floor(remainingSeconds(timer)) : null]);

  if (!timer) return null;

  const elapsed = elapsedSeconds(timer);
  const remaining = remainingSeconds(timer);
  const pct =
    timer.mode === "countdown"
      ? Math.min(100, Math.max(0, (elapsed / timer.targetSeconds) * 100))
      : Math.min(100, (elapsed / timer.targetSeconds) * 100);
  const overrun = timer.mode === "countdown" && remaining < 0;
  const display =
    timer.mode === "countdown"
      ? formatTimerDisplay(remaining)
      : formatTimerDisplay(elapsed);
  const isRunning = !!timer.runningSince;

  const handleStop = () => {
    const result = stopTimer({ saveHistory: true });
    setTimer(null);
    if (result.recorded) {
      const min = (result.totalSeconds / 60).toFixed(1);
      toast({
        title: "Logged",
        description: `${result.recorded.eventTitle} · ${min} min`,
      });
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(560px,calc(100vw-2rem))]">
      <div
        className={`relative overflow-hidden rounded-md border bg-popover/95 backdrop-blur-md shadow-xl ${
          overrun ? "border-destructive/60" : "border-gold/40"
        }`}
      >
        <div
          className={`absolute inset-y-0 left-0 transition-[width] duration-1000 ease-linear ${
            overrun
              ? "bg-destructive/15"
              : timer.mode === "countdown"
                ? "bg-gold/15"
                : "bg-teal/15"
          }`}
          style={{ width: `${pct}%` }}
          aria-hidden
        />
        <div className="relative flex items-center gap-3 px-4 py-3">
          <TimerIcon
            className={`h-4 w-4 shrink-0 ${
              overrun ? "text-destructive" : "text-gold"
            }`}
          />
          <div className="min-w-0 flex-1">
            <div className="font-display text-sm text-foreground line-clamp-1">
              {timer.eventTitle}
            </div>
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              {timer.mode === "countdown"
                ? overrun
                  ? "Over · still tracking"
                  : "Countdown"
                : "Stopwatch"}
              {!isRunning && " · paused"}
            </div>
          </div>
          <div
            className={`font-display text-2xl tabular-nums ${
              overrun ? "text-destructive" : "text-foreground"
            }`}
          >
            {display}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isRunning ? (
              <button
                type="button"
                onClick={() => {
                  pauseTimer();
                  setTimer(getActiveTimer());
                }}
                className="p-2 rounded hover:bg-muted/40 text-muted-foreground hover:text-gold transition-colors"
                aria-label="Pause timer"
              >
                <Pause className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  resumeTimer();
                  setTimer(getActiveTimer());
                }}
                className="p-2 rounded hover:bg-muted/40 text-muted-foreground hover:text-gold transition-colors"
                aria-label="Resume timer"
              >
                <Play className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleStop}
              className="p-2 rounded hover:bg-muted/40 text-muted-foreground hover:text-destructive transition-colors"
              aria-label="Stop timer"
            >
              <Square className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
