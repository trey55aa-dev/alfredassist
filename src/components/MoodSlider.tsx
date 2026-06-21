import { useRef } from "react";
import { moodColor, moodEmoji, MOOD_GRADIENT } from "@/lib/mood";

interface Props {
  value: number; // 1–10
  onChange: (v: number) => void;
}

const LABELS = ["", "Very low", "", "Low", "", "Neutral", "", "Good", "", "Great", "Amazing"];

export function MoodSlider({ value, onChange }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  const pct = ((value - 1) / 9) * 100;
  const color = moodColor(value);
  const emoji = moodEmoji(value);

  return (
    <div className="select-none px-2">
      {/* Emoji + value display */}
      <div className="flex flex-col items-center gap-1 mb-6">
        <div
          className="text-5xl transition-all duration-200"
          style={{ filter: `drop-shadow(0 0 12px ${color}60)` }}
        >
          {emoji}
        </div>
        <div
          className="font-display text-3xl font-semibold transition-colors duration-300"
          style={{ color }}
        >
          {value}
        </div>
        <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
          {LABELS[value]}
        </div>
      </div>

      {/* Slider track */}
      <div ref={trackRef} className="relative py-3">
        {/* Gradient track */}
        <div
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 rounded-full"
          style={{ background: MOOD_GRADIENT }}
        />

        {/* Progress overlay (filled portion glow) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-3 rounded-l-full transition-all duration-150"
          style={{
            left: 0,
            width: `${pct}%`,
            boxShadow: `0 0 8px 1px ${color}80`,
            background: "transparent",
          }}
        />

        {/* Native range input (invisible but handles interaction) */}
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative w-full h-3 appearance-none bg-transparent cursor-pointer z-10"
          style={
            {
              "--thumb-color": color,
            } as React.CSSProperties
          }
        />
      </div>

      {/* Tick labels */}
      <div className="flex justify-between mt-1 px-0.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`font-mono text-[10px] w-5 text-center transition-colors ${
              n === value
                ? "font-bold"
                : "text-muted-foreground/50 hover:text-muted-foreground"
            }`}
            style={n === value ? { color } : {}}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Thumb + track CSS */}
      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--thumb-color, #D4AF37);
          border: 3px solid rgba(255,255,255,0.15);
          box-shadow: 0 0 10px var(--thumb-color, #D4AF37), 0 2px 8px rgba(0,0,0,0.5);
          cursor: pointer;
          transition: box-shadow 0.15s, transform 0.1s;
        }
        input[type=range]::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }
        input[type=range]::-webkit-slider-thumb:active {
          transform: scale(1.25);
        }
        input[type=range]::-moz-range-thumb {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--thumb-color, #D4AF37);
          border: 3px solid rgba(255,255,255,0.15);
          box-shadow: 0 0 10px var(--thumb-color, #D4AF37);
          cursor: pointer;
        }
        input[type=range]:focus {
          outline: none;
        }
      `}</style>
    </div>
  );
}
