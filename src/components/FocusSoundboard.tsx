import { useState } from "react";
import {
  Link2,
  Loader2,
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CUSTOM_STATION_ID } from "@/lib/focusSounds";
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
  const [showCustom, setShowCustom] = useState(audio.stationId === CUSTOM_STATION_ID);

  const VolIcon = audio.volume === 0 ? VolumeX : audio.volume < 0.5 ? Volume1 : Volume2;
  const stationsInVibe =
    audio.currentVibe?.stationIds
      .map((id) => audio.stations.find((s) => s.id === id))
      .filter((s): s is NonNullable<typeof s> => !!s) ?? [];
  const isCustom = audio.stationId === CUSTOM_STATION_ID;

  return (
    <Card className="p-6 bg-gradient-card border-border">
      <h3 className="font-display text-2xl flex items-center gap-2 mb-4">
        <Music className="h-5 w-5 text-gold" /> Focus Sounds
      </h3>

      {/* Vibe selector */}
      <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-muted-foreground mb-2">
        Pick a vibe
      </div>
      <div className="flex flex-wrap gap-2">
        {audio.vibes.map((v) => {
          const active = audio.vibeId === v.id && !isCustom;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => audio.selectVibe(v.id)}
              title={v.blurb}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                active
                  ? "border-gold/60 bg-gold/15 text-gold"
                  : "border-border bg-background/30 text-muted-foreground hover:border-gold/40"
              }`}
            >
              <span>{v.emoji}</span>
              {v.label}
            </button>
          );
        })}
      </div>

      {/* Now playing / status */}
      <div className="mt-4 mb-3 min-h-[20px] flex items-center gap-2">
        {audio.error ? (
          <p className="font-mono text-[11px] text-destructive">{audio.error}</p>
        ) : audio.current ? (
          <>
            {audio.isPlaying && <Equalizer />}
            <p className="font-mono text-[11px] text-muted-foreground truncate">
              {audio.isPlaying ? "Now playing" : "Selected"}:{" "}
              <span className="text-gold">{audio.current.label}</span>
              {audio.current.credit && (
                <span className="text-muted-foreground/60"> · {audio.current.credit}</span>
              )}
            </p>
          </>
        ) : (
          <p className="font-mono text-[11px] text-muted-foreground/60">
            Pick a vibe to start the music.
          </p>
        )}
      </div>

      {/* Transport controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => audio.skip(-1)}
          disabled={!audio.currentVibe || isCustom}
          className="h-10 w-10 rounded-full border border-border flex items-center justify-center text-foreground hover:border-gold/50 hover:text-gold disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          aria-label="Previous station"
          title="Previous"
        >
          <SkipBack className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={audio.toggle}
          disabled={!audio.current}
          className="h-14 w-14 rounded-full bg-gradient-gold text-primary-foreground flex items-center justify-center hover:opacity-90 shadow-gold disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
          aria-label={audio.isPlaying ? "Pause" : "Play"}
        >
          {audio.loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : audio.isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </button>

        <button
          type="button"
          onClick={() => audio.skip(1)}
          disabled={!audio.currentVibe || isCustom}
          className="h-10 w-10 rounded-full border border-border flex items-center justify-center text-foreground hover:border-gold/50 hover:text-gold disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          aria-label="Skip to next station"
          title="Skip"
        >
          <SkipForward className="h-4 w-4" />
        </button>
      </div>

      {/* Stations within the current vibe — jump directly */}
      {stationsInVibe.length > 0 && !isCustom && (
        <>
          <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-muted-foreground mt-5 mb-2">
            {audio.currentVibe?.label} · {stationsInVibe.length} stations
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stationsInVibe.map((s) => {
              const active = audio.stationId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => audio.selectStation(s.id)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition-all ${
                    active
                      ? "border-gold/60 bg-gold/15 text-gold"
                      : "border-border bg-background/30 text-muted-foreground hover:border-gold/40"
                  }`}
                  title={s.sub}
                >
                  <span>{s.emoji}</span>
                  {s.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Custom stream */}
      <div className="mt-5">
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
                className={`shrink-0 rounded-lg border px-3 text-sm font-medium transition-colors ${
                  isCustom
                    ? "border-gold/60 bg-gold/20 text-gold"
                    : "border-gold/50 bg-gold/15 text-gold hover:bg-gold/25"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
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
