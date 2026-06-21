import { moodColor, moodLabel, MOOD_GRADIENT, VALENCE_LABELS } from "@/lib/mood";
import { MoodFace } from "./MoodFace";

interface Props {
  value: number; // 1–7
  onChange: (v: number) => void;
}

export function MoodSlider({ value, onChange }: Props) {
  const pct   = ((value - 1) / 6) * 100;
  const color = moodColor(value);
  const label = moodLabel(value);

  return (
    <div className="select-none px-1">
      {/* Animated face + label */}
      <div className="flex flex-col items-center gap-3 mb-7">
        <MoodFace value={value} size={130} />
        <div
          className="font-display text-2xl tracking-wide transition-colors duration-300"
          style={{ color }}
        >
          {label}
        </div>
      </div>

      {/* Gradient track + native range input */}
      <div className="relative py-3">
        <div
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 rounded-full"
          style={{ background: MOOD_GRADIENT }}
        />
        {/* Glow on filled portion */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-3 rounded-l-full transition-all duration-150 pointer-events-none"
          style={{
            left: 0,
            width: `${pct}%`,
            boxShadow: `0 0 10px 2px ${color}70`,
            background: "transparent",
          }}
        />
        <input
          type="range"
          min={1}
          max={7}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative w-full h-3 appearance-none bg-transparent cursor-pointer z-10"
          style={{ "--thumb-color": color } as React.CSSProperties}
        />
      </div>

      {/* 7 label ticks */}
      <div className="flex justify-between mt-2 px-0.5">
        {(VALENCE_LABELS.slice(1) as string[]).map((lbl, i) => {
          const v = i + 1;
          const active = v === value;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className={`flex-1 flex flex-col items-center gap-0.5 transition-all duration-200 ${
                active ? "opacity-100" : "opacity-40 hover:opacity-70"
              }`}
            >
              {/* Tick dot */}
              <div
                className="w-1.5 h-1.5 rounded-full transition-all duration-200"
                style={{ background: active ? color : "hsl(var(--muted-foreground))", transform: active ? "scale(1.5)" : "scale(1)" }}
              />
              {/* Short label — only show first word on small screens */}
              <span
                className="font-mono text-[7px] leading-tight tracking-wide text-center hidden sm:block"
                style={{ color: active ? color : undefined }}
              >
                {lbl.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Thumb CSS */}
      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 28px; height: 28px;
          border-radius: 50%;
          background: var(--thumb-color, #D4AF37);
          border: 3px solid rgba(255,255,255,0.18);
          box-shadow: 0 0 12px var(--thumb-color, #D4AF37), 0 2px 8px rgba(0,0,0,0.5);
          cursor: pointer;
          transition: box-shadow 0.15s, transform 0.1s;
        }
        input[type=range]::-webkit-slider-thumb:hover  { transform: scale(1.15); }
        input[type=range]::-webkit-slider-thumb:active { transform: scale(1.28); }
        input[type=range]::-moz-range-thumb {
          width: 28px; height: 28px; border-radius: 50%;
          background: var(--thumb-color, #D4AF37);
          border: 3px solid rgba(255,255,255,0.18);
          box-shadow: 0 0 12px var(--thumb-color, #D4AF37);
          cursor: pointer;
        }
        input[type=range]:focus { outline: none; }
      `}</style>
    </div>
  );
}
