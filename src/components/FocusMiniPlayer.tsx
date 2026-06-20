import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, Pause, SkipBack, SkipForward } from "lucide-react";
import { useFocusAudioContext } from "@/components/FocusAudioProvider";
import { getActiveTimer, TIMER_CHANGED } from "@/lib/taskTimer";

/**
 * Compact floating control shown on every page (except Focus) while focus audio
 * is playing — so the music keeps going and stays controllable as you navigate.
 * Sits above the ActiveTimerBar when a task timer is also running.
 */
export function FocusMiniPlayer() {
  const audio = useFocusAudioContext();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [timerActive, setTimerActive] = useState(() => !!getActiveTimer());

  useEffect(() => {
    const on = () => setTimerActive(!!getActiveTimer());
    window.addEventListener(TIMER_CHANGED, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(TIMER_CHANGED, on);
      window.removeEventListener("storage", on);
    };
  }, []);

  if (pathname === "/focus") return null;
  if (!audio.current || !(audio.isPlaying || audio.loading)) return null;

  const canSkip = !!audio.currentVibe;

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 z-40 w-[min(420px,calc(100vw-2rem))] ${
        timerActive ? "bottom-40 md:bottom-24" : "bottom-24 md:bottom-6"
      }`}
    >
      <div className="flex items-center gap-2 rounded-full border border-gold/40 bg-popover/95 backdrop-blur-md shadow-xl px-3 py-2">
        <button
          type="button"
          onClick={() => navigate("/focus")}
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
          title="Open Focus"
        >
          <span className="text-base shrink-0">{audio.current.emoji}</span>
          <span className="min-w-0">
            <span className="block text-xs font-medium text-foreground truncate">
              {audio.current.label}
            </span>
            <span className="block font-mono text-[9px] tracking-wider text-muted-foreground truncate">
              Focus Sounds · tap to open
            </span>
          </span>
        </button>

        <div className="flex items-center gap-0.5 shrink-0">
          {canSkip && (
            <button
              type="button"
              onClick={() => audio.skip(-1)}
              className="p-1.5 rounded-full text-muted-foreground hover:text-gold transition-colors"
              aria-label="Previous station"
            >
              <SkipBack className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={audio.toggle}
            className="h-8 w-8 rounded-full bg-gradient-gold text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
            aria-label="Pause"
          >
            {audio.loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
          </button>
          {canSkip && (
            <button
              type="button"
              onClick={() => audio.skip(1)}
              className="p-1.5 rounded-full text-muted-foreground hover:text-gold transition-colors"
              aria-label="Skip to next station"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
