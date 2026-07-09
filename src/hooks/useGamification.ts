import { useEffect, useState } from "react";
import {
  GamificationState,
  XP_AWARDED,
  XP_ADJUSTED,
  BADGE_UNLOCKED,
  LEVEL_UP,
  getGamification,
  levelFromXp,
  nextLevel,
  xpToNextLevel,
  Level,
} from "@/lib/gamification";

export function useGamification() {
  const [state, setState] = useState<GamificationState>(() => getGamification());

  useEffect(() => {
    const sync = () => setState(getGamification());
    window.addEventListener(XP_AWARDED, sync);
    window.addEventListener(XP_ADJUSTED, sync);
    window.addEventListener(BADGE_UNLOCKED, sync);
    window.addEventListener(LEVEL_UP, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(XP_AWARDED, sync);
      window.removeEventListener(XP_ADJUSTED, sync);
      window.removeEventListener(BADGE_UNLOCKED, sync);
      window.removeEventListener(LEVEL_UP, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const level = levelFromXp(state.xp);
  const next: Level | null = nextLevel(state.xp);
  const progress = xpToNextLevel(state.xp);

  return { state, level, next, progress };
}
