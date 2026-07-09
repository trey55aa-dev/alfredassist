// Gamification engine: XP, levels, badges.
// All state lives in localStorage so it's available instantly.
// awardXp() is fire-and-forget from any completion handler.

export const XP_VALUES = {
  HABIT_COMPLETE: 10,
  EVENT_COMPLETE: 5,
  GOAL_STEP_DONE: 25,
  GOAL_DONE: 100,
  PROGRESS_LOGGED: 5, // fallback when no target is set
  LIST_ITEM_DONE: 3,
  STREAK_7: 50,
  STREAK_30: 200,
  STREAK_90: 500,
  FOCUS_SESSION: 15,
} as const;

/**
 * Proportional XP for logging progress toward a goal.
 * Awards (delta / target) * 100 XP, so a goal completed entirely through
 * progress logs earns ~100 XP from logs + another 100 XP on GOAL_DONE.
 * Falls back to the flat PROGRESS_LOGGED value when target is missing.
 * Returns 0 for negative or zero deltas — going backwards earns no XP.
 */
export function progressXp(delta: number, target: number | undefined): number {
  if (delta <= 0) return 0; // no XP for setbacks or zero-progress logs
  if (!target || target <= 0) return XP_VALUES.PROGRESS_LOGGED;
  const pct = delta / target;
  return Math.max(1, Math.min(100, Math.round(pct * 100)));
}

export interface Level {
  level: number;
  minXp: number;
  title: string;
}

export const LEVELS: Level[] = [
  { level: 1,  minXp: 0,    title: "Recruit"           },
  { level: 2,  minXp: 100,  title: "Getting Started"   },
  { level: 3,  minXp: 300,  title: "Building Momentum" },
  { level: 4,  minXp: 600,  title: "Consistent"        },
  { level: 5,  minXp: 1000, title: "Committed"         },
  { level: 6,  minXp: 1500, title: "Disciplined"       },
  { level: 7,  minXp: 2200, title: "Relentless"        },
  { level: 8,  minXp: 3200, title: "Elite"             },
  { level: 9,  minXp: 4500, title: "Master"            },
  { level: 10, minXp: 6000, title: "Alfred's Champion" },
];

export function levelFromXp(xp: number): Level {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.minXp) current = l;
    else break;
  }
  return current;
}

export function nextLevel(xp: number): Level | null {
  const cur = levelFromXp(xp);
  return LEVELS.find((l) => l.level === cur.level + 1) ?? null;
}

export function xpToNextLevel(xp: number): { needed: number; progress: number; pct: number } {
  const next = nextLevel(xp);
  const cur = levelFromXp(xp);
  if (!next) return { needed: 0, progress: 0, pct: 100 };
  const needed = next.minXp - cur.minXp;
  const progress = xp - cur.minXp;
  return { needed, progress, pct: Math.min(100, Math.round((progress / needed) * 100)) };
}

/* ---------- Badges ---------- */

export interface BadgeDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  xpBonus: number;
}

export const BADGES: BadgeDef[] = [
  // Habits
  { id: "first_habit",   title: "First Step",        description: "Complete your first habit",            icon: "👟", xpBonus: 20  },
  { id: "streak_3",      title: "Hat Trick",          description: "3-day streak on any habit",            icon: "🔥", xpBonus: 15  },
  { id: "streak_7",      title: "Week Warrior",       description: "7-day streak on any habit",            icon: "⚡", xpBonus: 50  },
  { id: "streak_30",     title: "Month Strong",       description: "30-day streak on any habit",           icon: "💎", xpBonus: 200 },
  { id: "streak_90",     title: "Iron Will",          description: "90-day streak — you said no excuses",  icon: "🏆", xpBonus: 500 },
  { id: "comeback",      title: "Never Quit",         description: "Restore a streak after breaking it",   icon: "💫", xpBonus: 30  },
  // Goals
  { id: "first_goal",    title: "Goal Setter",        description: "Mark your first goal complete",         icon: "🎯", xpBonus: 50  },
  { id: "goals_3",       title: "On a Mission",       description: "Complete 3 goals",                     icon: "⚔️",  xpBonus: 100 },
  { id: "first_step",    title: "Plan to Win",        description: "Finish your first goal sub-step",      icon: "📋", xpBonus: 25  },
  // Agenda
  { id: "first_event",   title: "On Schedule",        description: "Complete your first agenda event",     icon: "📅", xpBonus: 10  },
  { id: "events_10",     title: "Calendar King",      description: "Complete 10 agenda events",            icon: "👑", xpBonus: 40  },
  { id: "early_bird",    title: "Early Bird",         description: "Complete 5 events before noon",        icon: "🌅", xpBonus: 30  },
  // Specific 2026 goals
  { id: "pushups_50",    title: "Halfway There",      description: "Log 50 push-ups total",                icon: "💪", xpBonus: 25  },
  { id: "pushups_100",   title: "Push King",          description: "Hit 100 push-ups in one go",           icon: "🥊", xpBonus: 100 },
  { id: "recipe_5",      title: "Home Chef",          description: "Master 5 recipes",                     icon: "🍳", xpBonus: 50  },
  { id: "recipe_10",     title: "Recipe Legend",      description: "Master all 10 recipes",                icon: "👨‍🍳", xpBonus: 100 },
  { id: "books_3",       title: "Bookworm",           description: "Read 3 books",                         icon: "📚", xpBonus: 50  },
  { id: "books_12",      title: "Literary Legend",    description: "Read 12 books — the full campaign",    icon: "🎓", xpBonus: 200 },
  { id: "save_1k",       title: "Money Moves",        description: "Save $1,000",                          icon: "💰", xpBonus: 50  },
  { id: "save_5k",       title: "Building Wealth",    description: "Save $5,000",                          icon: "💵", xpBonus: 150 },
  // Focus
  { id: "focus_1",       title: "In The Zone",        description: "Complete your first focus session",    icon: "🎯", xpBonus: 15  },
  { id: "focus_10",      title: "Deep Worker",        description: "Complete 10 focus sessions",           icon: "🧠", xpBonus: 75  },
  // Levels
  { id: "level_5",       title: "Halfway Up",         description: "Reach Level 5",                       icon: "⭐", xpBonus: 0   },
  { id: "level_10",      title: "Alfred's Champion",  description: "Reach Level 10 — the pinnacle",       icon: "🏆", xpBonus: 0   },
];

export const BADGE_MAP = new Map(BADGES.map((b) => [b.id, b]));

/* ---------- State ---------- */

export interface XpLogEntry {
  at: number;
  kind: "decay" | "manual";
  delta: number; // negative for losses
  note: string;
}

export interface GamificationState {
  xp: number;
  earnedBadges: string[]; // badge ids
  // Counters used by badge unlock checks
  habitsCompleted: number;
  eventsCompleted: number;
  goalsCompleted: number;
  goalStepsDone: number;
  progressLogs: number;
  focusSessions: number;
  earlyEvents: number; // events completed before noon
  // Life happens — XP breathes with real usage instead of only accumulating.
  lastActiveDay?: string;     // YYYY-MM-DD of the last XP-earning action
  decayAppliedUpTo?: string;  // YYYY-MM-DD we've already reconciled decay through
  xpLog?: XpLogEntry[];       // recent decay / manual recalibrations (capped)
}

const KEY = "alfred.gamification";
export const XP_AWARDED = "alfred.xp:awarded";
export const BADGE_UNLOCKED = "alfred.badge:unlocked";
export const LEVEL_UP = "alfred.level:up";
/** Fired when XP changes outside awardXp (decay / manual recalibration). */
export const XP_ADJUSTED = "alfred.xp:adjusted";

/* ---------- XP decay: the bar breathes with real usage ---------- */

/** Yesterday is grace (same rule as habit misses) — decay starts the day after. */
export const DECAY_GRACE_DAYS = 1;
/** Each fully-missed day beyond grace costs 2% of XP, compounding. */
export const DECAY_PER_DAY = 0.98;
/** One absence can never take more than 75% — coming back never means zero. */
export const DECAY_FLOOR_FACTOR = 0.25;
const XP_LOG_MAX = 20;

export function ymdOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function daysBetweenYmd(a: string, b: string): number {
  const ms = new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime();
  return Math.round(ms / 86_400_000);
}

/** XP remaining after `absentDays` fully-missed days (pure, testable). */
export function decayedXp(xp: number, absentDays: number): number {
  if (xp <= 0 || absentDays <= 0) return Math.max(0, xp);
  const factor = Math.max(DECAY_FLOOR_FACTOR, Math.pow(DECAY_PER_DAY, absentDays));
  return Math.round(xp * factor);
}

function appendXpLog(s: GamificationState, entry: XpLogEntry): void {
  s.xpLog = [...(s.xpLog ?? []), entry].slice(-XP_LOG_MAX);
}

/**
 * Apply decay for days the user was away — call once on app open. Idempotent:
 * `decayAppliedUpTo` tracks what's already been charged. First run only stamps
 * today (no retroactive punishment). Returns the decay applied, or null.
 */
export function reconcileXpDecay(now = new Date()): XpLogEntry | null {
  if (typeof window === "undefined") return null;
  const s = getGamification();
  const today = ymdOf(now);

  if (!s.lastActiveDay) {
    // Existing accounts start clean from today.
    s.lastActiveDay = today;
    s.decayAppliedUpTo = today;
    saveGamification(s);
    return null;
  }

  // Absent days = full days since last activity, minus grace, minus already-charged.
  const absentTotal = Math.max(0, daysBetweenYmd(s.lastActiveDay, today) - DECAY_GRACE_DAYS);
  const chargedThrough = s.decayAppliedUpTo ?? s.lastActiveDay;
  const alreadyCharged = Math.max(0, daysBetweenYmd(s.lastActiveDay, chargedThrough) - DECAY_GRACE_DAYS);
  const newAbsent = absentTotal - alreadyCharged;

  s.decayAppliedUpTo = today;
  if (newAbsent <= 0 || s.xp <= 0) {
    saveGamification(s);
    return null;
  }

  const before = s.xp;
  s.xp = decayedXp(before, newAbsent);
  const lost = before - s.xp;
  // No fanfare on the way down — the UI just reflects the new level.
  const entry: XpLogEntry = {
    at: now.getTime(),
    kind: "decay",
    delta: -lost,
    note: `away ${newAbsent + DECAY_GRACE_DAYS} day${newAbsent + DECAY_GRACE_DAYS === 1 ? "" : "s"}`,
  };
  appendXpLog(s, entry);
  saveGamification(s);
  window.dispatchEvent(new CustomEvent(XP_ADJUSTED, { detail: entry }));
  return lost > 0 ? entry : null;
}

/**
 * Manual recalibration — life changed, the goalposts moved. Sets XP to the
 * chosen level's threshold (up or down) and logs why.
 */
export function recalibrateToLevel(targetLevel: number, note = "recalibrated"): XpLogEntry | null {
  if (typeof window === "undefined") return null;
  const def = LEVELS.find((l) => l.level === targetLevel);
  if (!def) return null;
  const s = getGamification();
  const delta = def.minXp - s.xp;
  if (delta === 0) return null;
  s.xp = def.minXp;
  const entry: XpLogEntry = { at: Date.now(), kind: "manual", delta, note };
  appendXpLog(s, entry);
  saveGamification(s);
  window.dispatchEvent(new CustomEvent(XP_ADJUSTED, { detail: entry }));
  return entry;
}

export const EMPTY_STATE: GamificationState = {
  xp: 0,
  earnedBadges: [],
  habitsCompleted: 0,
  eventsCompleted: 0,
  goalsCompleted: 0,
  goalStepsDone: 0,
  progressLogs: 0,
  focusSessions: 0,
  earlyEvents: 0,
};

export function getGamification(): GamificationState {
  if (typeof window === "undefined") return { ...EMPTY_STATE };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY_STATE };
    return { ...EMPTY_STATE, ...(JSON.parse(raw) as Partial<GamificationState>) };
  } catch {
    return { ...EMPTY_STATE };
  }
}

function saveGamification(s: GamificationState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

/* ---------- Badge checks ---------- */

interface BadgeCheckArgs {
  state: GamificationState;
  reason: string;
  streakDays?: number;
  hourOfDay?: number;
  goalCurrent?: number;
  goalTarget?: number;
  unit?: string;
}

function checkBadges(args: BadgeCheckArgs): string[] {
  const { state, reason } = args;
  const earned = new Set(state.earnedBadges);
  const toUnlock: string[] = [];

  const tryUnlock = (id: string) => {
    if (!earned.has(id)) toUnlock.push(id);
  };

  if (reason === "habit") {
    if (state.habitsCompleted >= 1) tryUnlock("first_habit");
    if (args.streakDays && args.streakDays >= 3) tryUnlock("streak_3");
    if (args.streakDays && args.streakDays >= 7) tryUnlock("streak_7");
    if (args.streakDays && args.streakDays >= 30) tryUnlock("streak_30");
    if (args.streakDays && args.streakDays >= 90) tryUnlock("streak_90");
  }
  if (reason === "event") {
    if (state.eventsCompleted >= 1) tryUnlock("first_event");
    if (state.eventsCompleted >= 10) tryUnlock("events_10");
    if (args.hourOfDay !== undefined && args.hourOfDay < 12) {
      if (state.earlyEvents >= 5) tryUnlock("early_bird");
    }
  }
  if (reason === "goal") {
    if (state.goalsCompleted >= 1) tryUnlock("first_goal");
    if (state.goalsCompleted >= 3) tryUnlock("goals_3");
  }
  if (reason === "goal_step") {
    if (state.goalStepsDone >= 1) tryUnlock("first_step");
  }
  if (reason === "focus") {
    if (state.focusSessions >= 1) tryUnlock("focus_1");
    if (state.focusSessions >= 10) tryUnlock("focus_10");
  }
  // Goal-metric-specific badges
  if (reason === "progress" && args.goalCurrent !== undefined) {
    const unit = (args.unit ?? "").toLowerCase();
    if (unit === "reps" || unit.includes("push")) {
      if (args.goalCurrent >= 50) tryUnlock("pushups_50");
      if (args.goalCurrent >= 100) tryUnlock("pushups_100");
    }
    if (unit === "recipes" || unit.includes("recipe")) {
      if (args.goalCurrent >= 5) tryUnlock("recipe_5");
      if (args.goalCurrent >= 10) tryUnlock("recipe_10");
    }
    if (unit === "books" || unit.includes("book")) {
      if (args.goalCurrent >= 3) tryUnlock("books_3");
      if (args.goalCurrent >= 12) tryUnlock("books_12");
    }
    if (unit === "$" || unit.includes("dollar") || unit === "usd") {
      if (args.goalCurrent >= 1000) tryUnlock("save_1k");
      if (args.goalCurrent >= 5000) tryUnlock("save_5k");
    }
  }
  // Level badges
  const afterXpLevel = levelFromXp(state.xp);
  if (afterXpLevel.level >= 5) tryUnlock("level_5");
  if (afterXpLevel.level >= 10) tryUnlock("level_10");

  return toUnlock;
}

/* ---------- Award ---------- */

export interface AwardResult {
  xp: number;
  reason: string;
  newBadges: BadgeDef[];
  leveledUp: boolean;
  newLevel: Level | null;
}

export function awardXp(
  amount: number,
  reason: string,
  extra?: Partial<BadgeCheckArgs>,
): AwardResult {
  // 0 XP (e.g. logging negative progress) — skip all side-effects silently.
  if (amount <= 0) {
    return { xp: 0, reason, newBadges: [], leveledUp: false, newLevel: null };
  }

  if (typeof window === "undefined") {
    return { xp: amount, reason, newBadges: [], leveledUp: false, newLevel: null };
  }

  const state = getGamification();
  const prevLevel = levelFromXp(state.xp);

  // Bump counters — and mark today active, which resets the decay clock.
  const today = ymdOf(new Date());
  const next: GamificationState = {
    ...state,
    xp: state.xp + amount,
    lastActiveDay: today,
    decayAppliedUpTo: today,
  };
  if (reason === "habit") next.habitsCompleted += 1;
  if (reason === "event") {
    next.eventsCompleted += 1;
    if (extra?.hourOfDay !== undefined && extra.hourOfDay < 12) next.earlyEvents += 1;
  }
  if (reason === "goal") next.goalsCompleted += 1;
  if (reason === "goal_step") next.goalStepsDone += 1;
  if (reason === "progress") next.progressLogs += 1;
  if (reason === "focus") next.focusSessions += 1;

  // Badge bonus XP
  const newBadgeIds = checkBadges({ state: next, reason, ...extra });
  let bonusXp = 0;
  const newBadges: BadgeDef[] = [];
  for (const id of newBadgeIds) {
    const def = BADGE_MAP.get(id);
    if (def) {
      bonusXp += def.xpBonus;
      newBadges.push(def);
    }
  }
  next.xp += bonusXp;
  next.earnedBadges = [...new Set([...state.earnedBadges, ...newBadgeIds])];

  const newLevel = levelFromXp(next.xp);
  const leveledUp = newLevel.level > prevLevel.level;

  saveGamification(next);

  // Fire events for UI subscribers
  window.dispatchEvent(
    new CustomEvent<AwardResult>(XP_AWARDED, {
      detail: { xp: amount + bonusXp, reason, newBadges, leveledUp, newLevel: leveledUp ? newLevel : null },
    }),
  );
  for (const badge of newBadges) {
    window.dispatchEvent(new CustomEvent(BADGE_UNLOCKED, { detail: badge }));
  }
  if (leveledUp) {
    window.dispatchEvent(new CustomEvent(LEVEL_UP, { detail: newLevel }));
  }

  return { xp: amount + bonusXp, reason, newBadges, leveledUp, newLevel: leveledUp ? newLevel : null };
}
