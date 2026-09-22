import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play, Pause, RotateCcw, Maximize2, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { todayKey, formatTime } from "@/lib/alfred";
import { toast } from "sonner";
import { awardXp, XP_VALUES } from "@/lib/gamification";
import { useFocusAudioContext } from "@/components/FocusAudioProvider";
import { FocusSoundboard } from "@/components/FocusSoundboard";

const PRESETS = [10, 25, 45, 60];

export default function Focus() {
  const [duration, setDuration] = useState(25 * 60);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [zen, setZen] = useState(false);
  const tickRef = useRef<number | null>(null);
  const audio = useFocusAudioContext();

  // Escape backs out of zen view — never trap someone in a full-screen mode.
  useEffect(() => {
    if (!zen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zen]);

  const [stats, setStats] = useLocalStorage("alfred.focus.stats", {
    date: todayKey(),
    sessions: 0,
    minutes: 0,
  });

  // Reset stats per-day
  useEffect(() => {
    if (stats.date !== todayKey()) {
      setStats({ date: todayKey(), sessions: 0, minutes: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!running) return;
    tickRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(tickRef.current!);
          setRunning(false);
          setStats((prev) => ({
            date: todayKey(),
            sessions: (prev.date === todayKey() ? prev.sessions : 0) + 1,
            minutes: (prev.date === todayKey() ? prev.minutes : 0) + duration / 60,
          }));
          awardXp(XP_VALUES.FOCUS_SESSION, "focus");
          toast.success("Session complete", { description: "Excellent work, sir." });
          return duration;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [running, duration, setStats]);

  // Tie background audio to the timer when "Play when timer starts" is on.
  useEffect(() => {
    if (!audio.autoWithTimer || !audio.stationId) return;
    if (running) audio.play();
    else audio.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const choose = (mins: number) => {
    setRunning(false);
    setDuration(mins * 60);
    setRemaining(mins * 60);
  };

  const reset = () => {
    setRunning(false);
    setRemaining(duration);
  };

  const pct = ((duration - remaining) / duration) * 100;
  const radius = 130;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Deep work"
        title="Focus Timer"
        description="Set the interval. Begin the work. Let nothing interrupt you."
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-8 bg-gradient-card border-border flex flex-col items-center relative">
          <button
            type="button"
            onClick={() => setZen(true)}
            title="Large type — full-screen countdown, readable from across the room"
            className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-gold hover:border-gold/40 transition-all"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <div className="relative">
            <svg width="320" height="320" className="transform -rotate-90">
              <circle
                cx="160"
                cy="160"
                r={radius}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="6"
              />
              <circle
                cx="160"
                cy="160"
                r={radius}
                fill="none"
                stroke="hsl(var(--gold))"
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - dash}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-linear"
                style={{ filter: "drop-shadow(0 0 8px hsl(var(--gold) / 0.5))" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2">
                {running ? "In session" : "Ready"}
              </div>
              <div className="font-display text-7xl text-foreground tabular-nums">
                {formatTime(remaining)}
              </div>
              <div className="font-mono text-xs text-gold mt-2">{duration / 60} minutes</div>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <Button
              onClick={() => setRunning((r) => !r)}
              className="bg-gradient-gold text-primary-foreground hover:opacity-90 shadow-gold px-8"
              size="lg"
            >
              {running ? (
                <>
                  <Pause className="h-4 w-4 mr-2" /> Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" /> Begin
                </>
              )}
            </Button>
            <Button onClick={reset} variant="outline" size="lg" className="border-border">
              <RotateCcw className="h-4 w-4 mr-2" /> Reset
            </Button>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => choose(p)}
                className={`px-4 py-2 rounded-md font-mono text-xs tracking-wider uppercase transition-all ${
                  duration / 60 === p
                    ? "bg-gold text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-gold hover:bg-muted/70"
                }`}
              >
                {p} min
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
        <Card className="p-6 bg-gradient-card border-border h-fit">
          <h3 className="font-display text-2xl mb-4">Today's Tally</h3>
          <div className="space-y-4">
            <Stat label="Sessions" value={stats.date === todayKey() ? stats.sessions : 0} />
            <Stat
              label="Minutes focused"
              value={stats.date === todayKey() ? Math.round(stats.minutes) : 0}
            />
            <Stat
              label="Hours"
              value={
                stats.date === todayKey() ? (stats.minutes / 60).toFixed(1) : "0.0"
              }
            />
          </div>
          <div className="divider-gold my-5" />
          <p className="font-display italic text-sm text-muted-foreground">
            "Discipline is choosing between what you want now and what you want most."
          </p>
        </Card>

        <FocusSoundboard audio={audio} />
        </div>
      </div>

      {zen &&
        createPortal(
          // Portaled straight to <body> — a route-transition ancestor sets a
          // (no-op) transform on the page wrapper, which would otherwise make
          // this "fixed" overlay contain itself to that scrollable wrapper
          // instead of the real viewport.
          <div
            className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-8"
            onClick={() => setZen(false)}
            role="button"
            tabIndex={-1}
            title="Tap anywhere to exit"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setZen(false);
              }}
              aria-label="Exit large type"
              className="absolute top-6 right-6 h-10 w-10 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:text-gold hover:border-gold/40 transition-all"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="font-mono text-sm tracking-[0.3em] uppercase text-muted-foreground">
              {running ? "In session" : "Ready"}
            </div>
            <div className="font-display tabular-nums text-foreground leading-none text-[min(28vw,14rem)]">
              {formatTime(remaining)}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setRunning((r) => !r);
              }}
              className="flex items-center gap-3 rounded-full bg-gradient-gold text-primary-foreground shadow-gold px-8 py-4 text-lg"
            >
              {running ? (
                <>
                  <Pause className="h-6 w-6" /> Pause
                </>
              ) : (
                <>
                  <Play className="h-6 w-6" /> Begin
                </>
              )}
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="font-display text-3xl text-gold">{value}</div>
      <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
