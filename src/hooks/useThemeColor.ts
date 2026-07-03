import { useEffect, useState } from "react";

type ThemeColor = {
  name: string;
  background: string;
  foreground: string;
};

export type AccentColor = {
  name: string;
  /** Base HSL triple, e.g. "42 55% 62%" */
  hsl: string;
};

type AmbientSettings = {
  enabled: boolean;
  intensity: number; // 0-100
};

export const PRESET_THEMES: ThemeColor[] = [
  { name: "Midnight", background: "220 35% 6%", foreground: "42 38% 88%" },
  { name: "Deep Navy", background: "222 47% 11%", foreground: "210 40% 98%" },
  { name: "Charcoal", background: "220 13% 15%", foreground: "40 20% 90%" },
  { name: "Forest", background: "150 30% 8%", foreground: "100 30% 85%" },
  { name: "Burgundy", background: "340 25% 12%", foreground: "40 40% 88%" },
  { name: "Slate", background: "215 28% 17%", foreground: "210 40% 96%" },
  { name: "Onyx", background: "0 0% 4%", foreground: "0 0% 92%" },
  { name: "Navy", background: "225 60% 12%", foreground: "210 50% 95%" },
  { name: "Royal Purple", background: "270 45% 15%", foreground: "280 60% 90%" },
  { name: "Graphite", background: "220 10% 22%", foreground: "220 15% 85%" },
  { name: "Rose", background: "340 50% 12%", foreground: "350 60% 90%" },
  { name: "Crimson", background: "350 60% 10%", foreground: "25 80% 88%" },
  { name: "Emerald", background: "160 40% 8%", foreground: "140 50% 85%" },
  { name: "Amber", background: "30 60% 10%", foreground: "45 90% 88%" },
  { name: "Sapphire", background: "210 70% 15%", foreground: "200 80% 90%" },
  { name: "Violet", background: "260 50% 12%", foreground: "270 70% 88%" },
  { name: "Obsidian", background: "240 10% 8%", foreground: "220 20% 90%" },
  { name: "Moss", background: "120 25% 10%", foreground: "100 40% 82%" },
];

export const DEFAULT_ACCENT: AccentColor = {
  name: "Gold",
  hsl: "42 55% 62%",
};

export const PRESET_ACCENTS: AccentColor[] = [
  DEFAULT_ACCENT,
  { name: "Champagne", hsl: "45 70% 75%" },
  { name: "Bronze", hsl: "28 55% 50%" },
  { name: "Teal", hsl: "180 55% 55%" },
  { name: "Sky", hsl: "205 80% 65%" },
  { name: "Sapphire", hsl: "220 75% 60%" },
  { name: "Violet", hsl: "265 65% 65%" },
  { name: "Magenta", hsl: "320 70% 60%" },
  { name: "Rose", hsl: "345 75% 65%" },
  { name: "Crimson", hsl: "0 70% 55%" },
  { name: "Coral", hsl: "12 80% 65%" },
  { name: "Tangerine", hsl: "25 90% 60%" },
  { name: "Lime", hsl: "85 65% 55%" },
  { name: "Emerald", hsl: "150 60% 50%" },
  { name: "Mint", hsl: "165 55% 60%" },
  { name: "Silver", hsl: "220 10% 75%" },
];

const THEME_STORAGE_KEY = "alfred-theme-color";
const ACCENT_STORAGE_KEY = "alfred-accent-color";
const AMBIENT_STORAGE_KEY = "alfred-ambient-settings";
/** Fired on same-tab ambient changes so AmbientPattern can update without polling. */
export const AMBIENT_CHANGED = "alfred.ambient:changed";

const DEFAULT_AMBIENT: AmbientSettings = {
  enabled: true,
  intensity: 50,
};

/** Derive lighter/darker variants from a base HSL string. */
function deriveAccentVariants(hsl: string) {
  const parts = hsl.trim().split(/\s+/);
  const h = parseFloat(parts[0]) || 0;
  const s = parseFloat(parts[1]) || 50;
  const l = parseFloat(parts[2]) || 60;
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  return {
    base: `${h} ${s}% ${l}%`,
    glow: `${h} ${clamp(s + 15)}% ${clamp(l + 8)}%`,
    soft: `${h} ${clamp(s - 15)}% ${clamp(l - 7)}%`,
    deep: `${h - 4} ${clamp(s + 5)}% ${clamp(l - 20)}%`,
  };
}

function applyAccentVars(hsl: string) {
  const v = deriveAccentVariants(hsl);
  const root = document.documentElement.style;
  root.setProperty("--primary", v.base);
  root.setProperty("--primary-glow", v.glow);
  root.setProperty("--ring", v.base);
  root.setProperty("--gold", v.base);
  root.setProperty("--gold-soft", v.soft);
  root.setProperty("--gold-deep", v.deep);
  root.setProperty("--sidebar-primary", v.base);
  root.setProperty("--sidebar-ring", v.base);
  root.setProperty(
    "--gradient-gold",
    `linear-gradient(135deg, hsl(${v.base}) 0%, hsl(${v.deep}) 100%)`,
  );
  root.setProperty(
    "--shadow-gold",
    `0 10px 40px -10px hsl(${v.base} / 0.35)`,
  );
  root.setProperty(
    "--shadow-inset-gold",
    `inset 0 1px 0 0 hsl(${v.base} / 0.15)`,
  );
}

/** Convert "#rrggbb" to "h s% l%" string. */
export function hexToHsl(hex: string): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let H = 0;
  let S = 0;
  const L = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    S = L > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: H = (g - b) / d + (g < b ? 6 : 0); break;
      case g: H = (b - r) / d + 2; break;
      case b: H = (r - g) / d + 4; break;
    }
    H *= 60;
  }
  return `${Math.round(H)} ${Math.round(S * 100)}% ${Math.round(L * 100)}%`;
}

/** Convert "h s% l%" to "#rrggbb" for a color input. */
export function hslToHex(hsl: string): string {
  const parts = hsl.trim().split(/\s+/);
  const h = (parseFloat(parts[0]) || 0) / 360;
  const s = (parseFloat(parts[1]) || 0) / 100;
  const l = (parseFloat(parts[2]) || 0) / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function useThemeColor() {
  const [theme, setTheme] = useState<ThemeColor>(PRESET_THEMES[0]);
  const [accent, setAccent] = useState<AccentColor>(DEFAULT_ACCENT);
  const [ambient, setAmbient] = useState<AmbientSettings>(DEFAULT_AMBIENT);

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme) {
      try {
        const parsed = JSON.parse(savedTheme);
        const found = PRESET_THEMES.find((t) => t.name === parsed.name);
        if (found) setTheme(found);
      } catch {}
    }

    const savedAccent = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (savedAccent) {
      try {
        const parsed = JSON.parse(savedAccent) as AccentColor;
        if (parsed?.hsl) {
          setAccent(parsed);
          applyAccentVars(parsed.hsl);
        }
      } catch {}
    }

    const savedAmbient = localStorage.getItem(AMBIENT_STORAGE_KEY);
    if (savedAmbient) {
      try {
        setAmbient(JSON.parse(savedAmbient));
      } catch {}
    }
  }, []);

  const applyTheme = (newTheme: ThemeColor) => {
    setTheme(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(newTheme));
    document.documentElement.style.setProperty("--background", newTheme.background);
    document.documentElement.style.setProperty("--foreground", newTheme.foreground);
  };

  /** Pick ANY background color via hex; text color auto-derives for readability. */
  const applyThemeHex = (bgHex: string) => {
    const background = hexToHsl(bgHex);
    const parts = background.split(/\s+/);
    const h = parseFloat(parts[0]) || 0;
    const l = parseFloat(parts[2]) || 0;
    // Dark background → light text; light background → dark text.
    // Keep a hint of the background hue in the text so it feels cohesive.
    const foreground =
      l < 50 ? `${h} 30% 92%` : `${h} 30% 10%`;
    applyTheme({ name: "Custom", background, foreground });
  };

  const resetTheme = () => {
    const defaultTheme = PRESET_THEMES[0];
    applyTheme(defaultTheme);
  };

  const applyAccent = (next: AccentColor) => {
    setAccent(next);
    localStorage.setItem(ACCENT_STORAGE_KEY, JSON.stringify(next));
    applyAccentVars(next.hsl);
  };

  const applyAccentHex = (hex: string) => {
    const hsl = hexToHsl(hex);
    applyAccent({ name: "Custom", hsl });
  };

  const resetAccent = () => applyAccent(DEFAULT_ACCENT);

  const setAmbientEnabled = (enabled: boolean) => {
    const newAmbient = { ...ambient, enabled };
    setAmbient(newAmbient);
    localStorage.setItem(AMBIENT_STORAGE_KEY, JSON.stringify(newAmbient));
    window.dispatchEvent(new Event(AMBIENT_CHANGED));
  };

  const setAmbientIntensity = (intensity: number) => {
    const newAmbient = { ...ambient, intensity };
    setAmbient(newAmbient);
    localStorage.setItem(AMBIENT_STORAGE_KEY, JSON.stringify(newAmbient));
    window.dispatchEvent(new Event(AMBIENT_CHANGED));
  };

  return {
    theme,
    applyTheme,
    applyThemeHex,
    resetTheme,
    accent,
    applyAccent,
    applyAccentHex,
    resetAccent,
    accentPresets: PRESET_ACCENTS,
    ambient,
    setAmbientEnabled,
    setAmbientIntensity,
    presets: PRESET_THEMES,
  };
}
