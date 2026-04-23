import { useEffect, useState } from "react";

type ThemeColor = {
  name: string;
  background: string;
  foreground: string;
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
];

const THEME_STORAGE_KEY = "alfred-theme-color";
const AMBIENT_STORAGE_KEY = "alfred-ambient-settings";

const DEFAULT_AMBIENT: AmbientSettings = {
  enabled: true,
  intensity: 50,
};

export function useThemeColor() {
  const [theme, setTheme] = useState<ThemeColor>(PRESET_THEMES[0]);
  const [ambient, setAmbient] = useState<AmbientSettings>(DEFAULT_AMBIENT);

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme) {
      const parsed = JSON.parse(savedTheme);
      const found = PRESET_THEMES.find((t) => t.name === parsed.name);
      if (found) setTheme(found);
    }

    const savedAmbient = localStorage.getItem(AMBIENT_STORAGE_KEY);
    if (savedAmbient) {
      setAmbient(JSON.parse(savedAmbient));
    }
  }, []);

  const applyTheme = (newTheme: ThemeColor) => {
    setTheme(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(newTheme));
    document.documentElement.style.setProperty("--background", newTheme.background);
    document.documentElement.style.setProperty("--foreground", newTheme.foreground);
  };

  const resetTheme = () => {
    const defaultTheme = PRESET_THEMES[0];
    applyTheme(defaultTheme);
  };

  const setAmbientEnabled = (enabled: boolean) => {
    const newAmbient = { ...ambient, enabled };
    setAmbient(newAmbient);
    localStorage.setItem(AMBIENT_STORAGE_KEY, JSON.stringify(newAmbient));
  };

  const setAmbientIntensity = (intensity: number) => {
    const newAmbient = { ...ambient, intensity };
    setAmbient(newAmbient);
    localStorage.setItem(AMBIENT_STORAGE_KEY, JSON.stringify(newAmbient));
  };

  return {
    theme,
    applyTheme,
    resetTheme,
    ambient,
    setAmbientEnabled,
    setAmbientIntensity,
    presets: PRESET_THEMES,
  };
}
