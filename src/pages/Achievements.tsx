import { useState } from "react";
import { ChevronDown, ChevronRight, MoonStar, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useGamification } from "@/hooks/useGamification";
import { BADGES, LEVELS, recalibrateToLevel } from "@/lib/gamification";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function Achievements() {
  const { state, level, next, progress } = useGamification();
  const earned = new Set(state.earnedBadges);
  const [pickedLevel, setPickedLevel] = useState<number | "">("");
  const [showJourney, setShowJourney] = useState(false);

  // Level badges are spoilers until earned — everything else stays chaseable.
  const visibleBadges = BADGES.filter((b) => !b.id.startsWith("level_") || earned.has(b.id));

  // Most recent decay within the last week — worth explaining on the bar.
  const lastDecay = (state.xpLog ?? [])
    .filter((e) => e.kind === "decay" && e.at > Date.now() - 7 * 86_400_000)
    .at(-1);

  const applyRecalibrate = () => {
    if (pickedLevel === "" || pickedLevel === level.level) return;
    const entry = recalibrateToLevel(pickedLevel, "life changed — recalibrated");
    if (entry) {
      const dir = entry.delta > 0 ? "up" : "down";
      toast.success(`Recalibrated ${dir} to Level ${pickedLevel}. The bar now matches your life.`);
      setPickedLevel("");
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Your campaign"
        title="Achievements"
        description="XP, levels, and badges earned through daily action."
      />

      {/* Level card */}
      <Card className="p-6 bg-gradient-card border-border">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <div>
            <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-gold mb-1">
              Level {level.level}
            </div>
            <h2 className="font-display text-4xl text-foreground">{level.title}</h2>
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground mt-1">
              {state.xp.toLocaleString()} XP total
            </p>
          </div>
          <div className="text-right shrink-0">
            {next ? (
              <>
                <div className="font-display text-5xl text-gold leading-none">
                  {progress.pct}%
                </div>
                <div className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground mt-1">
                  to Level {next.level}
                </div>
              </>
            ) : (
              <div className="font-display text-3xl text-gold">MAX</div>
            )}
          </div>
        </div>

        <Progress value={progress.pct} className="h-2 mb-2" />

        {next && (
          <div className="flex justify-between font-mono text-[9px] tracking-wider uppercase text-muted-foreground">
            <span>{progress.progress} XP</span>
            <span>{progress.needed} XP to {next.title}</span>
          </div>
        )}

        {/* Away notice — the bar breathes with real life */}
        {lastDecay && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
            <MoonStar className="h-3.5 w-3.5 text-teal shrink-0" />
            <p className="text-xs text-muted-foreground">
              Welcome back — {Math.abs(lastDecay.delta).toLocaleString()} XP eased off while you were{" "}
              {lastDecay.note}. It comes back the same way it was earned.
            </p>
          </div>
        )}

        {/* Manual recalibration — the goalposts moved, match the bar to reality */}
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-muted/10 px-3 py-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-gold/70 shrink-0" />
          <span className="text-xs text-muted-foreground flex-1 min-w-[10rem]">
            Life changed? Set the level that matches where you really are.
          </span>
          <select
            value={pickedLevel}
            onChange={(e) => setPickedLevel(e.target.value === "" ? "" : Number(e.target.value))}
            className="bg-background/40 border border-border rounded-md px-2 py-1.5 text-[11px] font-mono uppercase tracking-wider text-foreground focus:outline-none focus:ring-2 focus:ring-gold/40"
            aria-label="Pick your real level"
          >
            <option value="">Level…</option>
            {/* Only levels you've walked (plus one up) — no spoiling the summit. */}
            {LEVELS.filter((l) => l.level <= level.level + 1).map((l) => (
              <option key={l.level} value={l.level} disabled={l.level === level.level}>
                {l.level} · {l.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyRecalibrate}
            disabled={pickedLevel === "" || pickedLevel === level.level}
            className="rounded-md border border-gold/40 bg-gold/10 px-2.5 py-1.5 font-mono text-[10px] tracking-wider uppercase text-gold hover:bg-gold/20 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            Recalibrate
          </button>
        </div>

        {/* Your journey — collapsed by default, and even open it only shows
            where you've been plus the next rung. The rest of the path stays
            out of sight: compare with yesterday's you, not the summit. */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowJourney((v) => !v)}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-gold transition-colors"
          >
            {showJourney ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Your journey
          </button>

          {showJourney && (
            <div className="mt-2 space-y-1.5">
              {LEVELS.filter((l) => l.level <= level.level + 1).map((l) => {
                const isCurrentLevel = l.level === level.level;
                const isPast = l.level < level.level;
                return (
                  <div
                    key={l.level}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 transition-all ${
                      isCurrentLevel
                        ? "bg-gold/10 border border-gold/30"
                        : isPast
                          ? "bg-background/30 border border-border/40"
                          : "border border-dashed border-border/30 opacity-50"
                    }`}
                  >
                    <div
                      className={`font-mono text-[10px] tracking-[0.2em] uppercase shrink-0 w-12 ${
                        isCurrentLevel
                          ? "text-gold"
                          : isPast
                            ? "text-muted-foreground"
                            : "text-muted-foreground/50"
                      }`}
                    >
                      Lvl {l.level}
                    </div>
                    <div className={`text-sm flex-1 ${isCurrentLevel ? "text-foreground font-medium" : isPast ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                      {l.title}
                    </div>
                    <div className="font-mono text-[9px] text-muted-foreground shrink-0">
                      {l.minXp.toLocaleString()} XP
                    </div>
                    {isPast && <span className="text-gold text-xs shrink-0">✓</span>}
                    {isCurrentLevel && (
                      <span className="font-mono text-[9px] text-gold uppercase tracking-wider shrink-0">
                        You
                      </span>
                    )}
                  </div>
                );
              })}
              {level.level + 1 < LEVELS.length && (
                <p className="px-3 font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground/40">
                  …the path continues from there
                </p>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Stats */}
      <Card className="p-6 bg-gradient-card border-border">
        <h3 className="font-display text-2xl mb-4">Stats</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: "Habits done", value: state.habitsCompleted },
            { label: "Events done", value: state.eventsCompleted },
            { label: "Goals done", value: state.goalsCompleted },
            { label: "Steps done", value: state.goalStepsDone },
            { label: "Progress logs", value: state.progressLogs },
            { label: "Focus sessions", value: state.focusSessions },
          ].map((s) => (
            <div key={s.label} className="rounded-md bg-background/30 border border-border/60 p-3">
              <div className="font-display text-3xl text-gold">{s.value}</div>
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground mt-0.5">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Badges — unearned level badges stay hidden: their text ("Reach Level
          10") is exactly the how-far-to-the-top reveal we keep out of sight.
          They surface as a surprise the day they're earned. */}
      <Card className="p-6 bg-gradient-card border-border">
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-display text-2xl">Badges</h3>
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
            {state.earnedBadges.length} / {visibleBadges.length}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visibleBadges.map((b) => {
            const isEarned = earned.has(b.id);
            return (
              <div
                key={b.id}
                className={`flex items-center gap-3 rounded-md border p-3 transition-all ${
                  isEarned
                    ? "bg-background/50 border-gold/30"
                    : "bg-background/20 border-border/40 opacity-50"
                }`}
              >
                <span
                  className={`text-2xl shrink-0 ${isEarned ? "" : "grayscale"}`}
                  style={{ filter: isEarned ? "none" : "grayscale(100%)" }}
                >
                  {b.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-sm font-medium leading-snug ${
                      isEarned ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {b.title}
                  </div>
                  <div className="font-mono text-[9px] text-muted-foreground/80 leading-snug mt-0.5">
                    {b.description}
                  </div>
                </div>
                {isEarned ? (
                  <span className="text-gold text-xs shrink-0">✓</span>
                ) : b.xpBonus > 0 ? (
                  <span className="font-mono text-[9px] text-muted-foreground/60 shrink-0">
                    +{b.xpBonus}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
