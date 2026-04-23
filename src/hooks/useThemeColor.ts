import { useEffect, useState } from "react";

type ThemeColor = {
  name: string;
  background: string;
  foreground: string;
};

export const PRESET_THEMES: ThemeColor[] = [
  { name: "Midnight", background: "220 35% 6%", foreground: "42 38% 88%" },
  { name: "Deep Navy", background: "222 47% 11%", foreground: "210 40% 98%" },
  { name: "Charcoal", background: "220 13% 15%", foreground: "40 20% 90%" },
  { name: "Forest", background: "150 30% 8%", foreground: "100 30% 85%" },
  { name: "Burgundy", background: "340 25% 12%", foreground: "40 40% 88%" },
  { name: "Slate", background: "215 28% 17%", foreground: "210 40% 96%" },
];

const STORAGE_KEY = "alfred-theme-color";

export function useThemeColor() {
  const [theme, setTheme] = useState<ThemeColor>(PRESET_THEMES[0]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const found = PRESET_THEMES.find((t) => t.name === parsed.name);
      if (found) setTheme(found);
    }
  }, []);

  const applyTheme = (newTheme: ThemeColor) => {
    setTheme(newTheme);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newTheme));
    document.documentElement.style.setProperty("--background", newTheme.background);
    document.documentElement.style.setProperty("--foreground", newTheme.foreground);
  };

  const resetTheme = () => {
    const defaultTheme = PRESET_THEMES[0];
    applyTheme(defaultTheme);
  };

  return {
    theme,
    applyTheme,
    resetTheme,
    isOpen,
    setIsOpen,
    presets: PRESET_THEMES,
  };
}
