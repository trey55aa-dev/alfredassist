import { useState } from "react";
import { Link2, Loader2, Music, Pause, Play, Volume1, Volume2, VolumeX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CUSTOM_SOUND_ID } from "@/lib/focusSounds";
import type { FocusAudio } from "@/hooks/useFocusAudio";

/** Animated "now playing" equalizer bars. */
function Equalizer() {
  return (
    <span className="inline-flex items-end gap-0.5 h-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-0.5 bg-gold rounded-full animate-pulse"
          style={{ height: ["100%", "60%", "85%"][i], animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}

export function FocusSoundboard({ audio }: { audio: FocusAudio }) {
  const [showCustom, setShowCustom] = useState(audio.selectedId === CUSTOM_SOUND_ID);

  const radio = audio.sounds.filter((s) => s.kind === "radio");
  const ambient = audio.sounds.filter((s) => s.kind === "ambient");

  const VolIcon = audio.volume === 0 ? VolumeX : audio.volume < 0.5 ? Volume1 : Volume2;

  const Chip = ({ id, emoji, label, sub }: { id: string; emoji: string; label: string; sub: string }) => {
    const active = audio.selectedId === id;
    return (
      <button
        type="button"
        onClick={() => audio.select(id)}
        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all ${
          active
            ? "border-gold/60 bg-gold/15"
            : "border-border bg-background/30 hover:border-gold/40 hover:bg-background/50"
        }`}
      >
        <span className="text-lg shrink-0">{emoji}</span>
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-medium truncate ${active ? "text-gold" : "text-foreground"}`}>
            {label}
          </span>
          <span className="block font-mono text-[9px] tracking-wider text-muted-foreground truncate">
            {sub}
          </span>
        </span>
        {active && audio.isPlaying && <Equalizer />}
      </button>
    );
  };

  return (
    <Card className="p-6 bg-gradient-card border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-2xl flex items-center gap-2">
          <Music className="h-5 w-5 text-gold" /> Focus Sounds
        </h3>
        <button
          type="button"
          onClick={audio.toggle}
          disabled={!audio.current}
          className="h-10 w-10 rounded-full bg-gradient-gold text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
          aria-label={audio.isPlaying ? "Pause" : "Play"}
        >
          {audio.loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : audio.isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </button>
      </div>

      {/* Now playing / status */}
      <div className="mb-4 min-h-[20px]">
        {audio.error ? (
          <p className="font-mono text-[11px] text-destructive">{audio.error}</p>
        ) : audio.current ? (
          <p className="font-mono text-[11px] text-muted-foreground">
            {audio.isPlaying ? "Now playing" : "Selected"}:{" "}
            <span className="text-gold">{audio.current.label}</span>
            {audio.current.credit && <span className="text-muted-foreground/60"> · {audio.current.credit}</span>}
          </p>
        ) : (
          <p className="font-mono text-[11px] text-muted-foreground/60">Pick a sound to play while you work.</p>
        )}
      </div>

      {/* Music stations */}
      <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-muted-foreground mb-2">Music · radio</div>
      <div className="grid grid-cols-2 gap-2">
        {radio.map((s) => (
          <Chip key={s.id} id={s.id} emoji={s.emoji} label={s.label} sub={s.sub} />
        ))}
      </div>

      {/* Ambient */}
      <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-muted-foreground mt-4 mb-2">
        Ambient · offline
      </div>
      <div className="grid grid-cols-3 gap-2">
        {ambient.map((s) => (
          <Chip key={s.id} id={s.id} emoji={s.emoji} label={s.label} sub={s.sub} />
        ))}
      </div>

      {/* Custom stream */}
      <div className="mt-4">
        {!showCustom ? (
          <button
            type="button"
            onClick={() => setShowCustom(true)}
            className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase text-muted-foreground hover:text-gold transition-colors"
          >
            <Link2 className="h-3.5 w-3.5" /> Add your own stream
          </button>
        ) : (
          <div className="space-y-2">
            <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-muted-foreground">
              Custom stream URL
            </div>
            <div className="flex gap-2">
              <Input
                value={audio.customUrl}
                onChange={(e) => audio.setCustomUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") audio.applyCustom(); }}
                placeholder="https://…/stream.mp3"
                className="h-10 text-sm bg-background/60 border-border"
              />
              <button
                type="button"
                onClick={audio.applyCustom}
                disabled={!audio.customUrl.trim()}
                className="shrink-0 rounded-lg border border-gold/50 bg-gold/15 px-3 text-sm font-medium text-gold hover:bg-gold/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Play
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="divider-gold my-5" />

      {/* Volume */}
      <div className="flex items-center gap-3">
        <VolIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={audio.volume}
          onChange={(e) => audio.setVolume(Number(e.target.value))}
          className="flex-1 h-1.5 accent-[hsl(var(--gold))] cursor-pointer"
          aria-label="Volume"
        />
        <span className="font-mono text-[10px] text-muted-foreground w-8 text-right tabular-nums">
          {Math.round(audio.volume * 100)}
        </span>
      </div>

      {/* Play with timer */}
      <div className="flex items-center justify-between mt-4">
        <span className="font-mono text-[11px] text-muted-foreground">Play when timer starts</span>
        <Switch
          checked={audio.autoWithTimer}
          onCheckedChange={audio.setAutoWithTimer}
          className="data-[state=checked]:bg-gold h-5 w-9"
        />
      </div>

      <p className="font-mono text-[8px] tracking-wider text-muted-foreground/50 text-center mt-4">
        Radio streamed free via SomaFM — listener-supported, no ads.
      </p>
    </Card>
  );
}
