// A single active "challenge" — the 35-Day Reset and things like it. Alfred
// has no generic multi-challenge system; this is deliberately one small,
// editable record so the header never shows a permanently-wrong date.

export interface ChallengeConfig {
  title: string;
  startDate: string; // YYYY-MM-DD, local
  totalDays: number;
}

const KEY = "alfred.challenge";

export const DEFAULT_CHALLENGE: ChallengeConfig = {
  title: "35-Day Reset",
  startDate: "2026-08-08",
  totalDays: 35,
};

export function getChallenge(): ChallengeConfig {
  if (typeof window === "undefined") return DEFAULT_CHALLENGE;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_CHALLENGE;
    const parsed = JSON.parse(raw) as Partial<ChallengeConfig>;
    if (!parsed.title || !parsed.startDate || !parsed.totalDays) return DEFAULT_CHALLENGE;
    return parsed as ChallengeConfig;
  } catch {
    return DEFAULT_CHALLENGE;
  }
}

export function setChallenge(cfg: ChallengeConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg));
  } catch {
    /* quota */
  }
}

export type ChallengeState = "upcoming" | "active" | "complete";

export interface ChallengeStatus {
  state: ChallengeState;
  /** 1-indexed. Clamped to [1, totalDays] even in "complete" state. */
  dayNumber: number;
  totalDays: number;
  daysUntilStart: number;
  /** Fraction of the challenge elapsed, clamped to [0, 1] — for a progress bar. */
  pctElapsed: number;
}

function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function challengeStatus(cfg: ChallengeConfig, now = new Date()): ChallengeStatus {
  const start = dateOnly(new Date(cfg.startDate + "T00:00:00"));
  const today = dateOnly(now);
  const elapsedDays = Math.round((today.getTime() - start.getTime()) / 86_400_000);

  if (elapsedDays < 0) {
    return {
      state: "upcoming",
      dayNumber: 1,
      totalDays: cfg.totalDays,
      daysUntilStart: -elapsedDays,
      pctElapsed: 0,
    };
  }
  if (elapsedDays >= cfg.totalDays) {
    return {
      state: "complete",
      dayNumber: cfg.totalDays,
      totalDays: cfg.totalDays,
      daysUntilStart: 0,
      pctElapsed: 1,
    };
  }
  return {
    state: "active",
    dayNumber: elapsedDays + 1,
    totalDays: cfg.totalDays,
    daysUntilStart: 0,
    pctElapsed: (elapsedDays + 1) / cfg.totalDays,
  };
}
