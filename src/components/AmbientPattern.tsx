import { useEffect, useState } from "react";
import { countCompletedToday, LOCAL_EVENTS_CHANGED } from "@/lib/agendaStore";
import { AMBIENT_CHANGED } from "@/hooks/useThemeColor";

interface AmbientSettings {
  enabled: boolean;
  intensity: number;
}

const STORAGE_KEY = "alfred-ambient-settings";
const DEFAULT_SETTINGS: AmbientSettings = { enabled: true, intensity: 50 };

function loadSettings(): AmbientSettings {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
}

/**
 * Fixed background overlay whose pattern density grows as more events are
 * completed today. Layered SVG patterns + gradient washes — purely decorative.
 */
export function AmbientPattern() {
  const [count, setCount] = useState(0);
  const [settings, setSettings] = useState<AmbientSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const refresh = () => {
      setCount(countCompletedToday());
      setSettings(loadSettings());
    };
    refresh();
    // Event-driven — no more 1s polling. Completed-count changes fire
    // LOCAL_EVENTS_CHANGED; ambient toggle/slider fires AMBIENT_CHANGED;
    // "storage" covers other tabs.
    window.addEventListener(LOCAL_EVENTS_CHANGED, refresh);
    window.addEventListener(AMBIENT_CHANGED, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LOCAL_EVENTS_CHANGED, refresh);
      window.removeEventListener(AMBIENT_CHANGED, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  if (!settings.enabled) return null;

  // Intensity multiplier: 0.2 at 10% to 1.5 at 100%
  const intensityMult = 0.2 + (settings.intensity / 100) * 1.3;

  // Tiered intensity. Each tier layers a new motif on top.
  const tier = Math.min(count, 6);
  const baseOpacity = Math.min(0.04 + tier * 0.025, 0.18);
  const opacityWash = baseOpacity * intensityMult;
  const huesShift = tier * 6; // subtle warm shift

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden transition-opacity duration-1000"
    >
      {/* Warm wash that intensifies */}
      <div
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          background: `radial-gradient(ellipse at 20% 0%, hsl(${42 + huesShift} 55% 40% / ${opacityWash}) 0%, transparent 55%), radial-gradient(ellipse at 80% 100%, hsl(180 40% 35% / ${opacityWash * 0.7}) 0%, transparent 60%)`,
        }}
      />

      {/* Tier 1+: dotted weave */}
      {tier >= 1 && (
        <div
          className="absolute inset-0 transition-opacity duration-700"
          style={{
            opacity: 0.35 * intensityMult,
            backgroundImage:
              "radial-gradient(hsl(var(--gold) / 0.08) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
      )}

      {/* Tier 2+: fine grid */}
      {tier >= 2 && (
        <div
          className="absolute inset-0 transition-opacity duration-700"
          style={{
            opacity: 0.25 * intensityMult,
            backgroundImage:
              "linear-gradient(hsl(var(--gold) / 0.06) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--gold) / 0.06) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
      )}

      {/* Tier 3+: cross-hatch diagonals */}
      {tier >= 3 && (
        <div
          className="absolute inset-0 transition-opacity duration-700"
          style={{
            opacity: 0.2 * intensityMult,
            backgroundImage:
              "repeating-linear-gradient(45deg, hsl(var(--gold) / 0.05) 0 1px, transparent 1px 14px), repeating-linear-gradient(-45deg, hsl(var(--teal) / 0.04) 0 1px, transparent 1px 22px)",
          }}
        />
      )}

      {/* Tier 4+: ornamental fleur scatter (SVG data URI) */}
      {tier >= 4 && (
        <div
          className="absolute inset-0 transition-opacity duration-700"
          style={{
            opacity: 0.18 * intensityMult,
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><g fill='none' stroke='%23d4af6a' stroke-width='0.6' opacity='0.6'><circle cx='60' cy='60' r='22'/><path d='M60 38c6 8 6 36 0 44M38 60c8-6 36-6 44 0'/><circle cx='60' cy='60' r='2' fill='%23d4af6a'/></g></svg>")`,
            backgroundSize: "180px 180px",
          }}
        />
      )}

      {/* Tier 5+: filigree corners */}
      {tier >= 5 && (
        <>
          <div
            className="absolute top-0 left-0 h-48 w-48 transition-opacity duration-700"
            style={{
              opacity: 0.35 * intensityMult,
              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><g fill='none' stroke='%23d4af6a' stroke-width='0.8' opacity='0.7'><path d='M10 10 Q 80 10 80 80 Q 10 80 10 10 Z'/><path d='M30 30 Q 70 30 70 70'/><circle cx='10' cy='10' r='3' fill='%23d4af6a'/></g></svg>")`,
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
            }}
          />
          <div
            className="absolute bottom-0 right-0 h-48 w-48 rotate-180 transition-opacity duration-700"
            style={{
              opacity: 0.35 * intensityMult,
              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><g fill='none' stroke='%23d4af6a' stroke-width='0.8' opacity='0.7'><path d='M10 10 Q 80 10 80 80 Q 10 80 10 10 Z'/><path d='M30 30 Q 70 30 70 70'/><circle cx='10' cy='10' r='3' fill='%23d4af6a'/></g></svg>")`,
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
            }}
          />
        </>
      )}

      {/* Tier 6: shimmering vignette — a flourish for a perfect day */}
      {tier >= 6 && (
        <div
          className="absolute inset-0 transition-opacity duration-700"
          style={{
            opacity: 0.5 * intensityMult,
            background:
              "radial-gradient(ellipse at center, transparent 55%, hsl(var(--gold) / 0.08) 100%)",
          }}
        />
      )}
    </div>
  );
}
