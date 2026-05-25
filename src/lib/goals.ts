export type GoalCategory = "Body" | "Career" | "Money" | "Skills" | "Life";
export type GoalTimeframe = "daily" | "monthly" | "quarterly" | "annual";
export type GoalQuarter = "Q1" | "Q2" | "Q3" | "Q4" | null;

export type SubStepStatus = "pending" | "in_progress" | "done" | "at_risk" | "blocked";

export interface StatusEvent {
  status: SubStepStatus;
  /** ISO timestamp when this transition happened. */
  at: string;
  /** Optional note captured at the moment of change. */
  note?: string;
}

export interface GoalSubStep {
  id: string;
  title: string;
  detail?: string;
  /** Estimated duration in weeks (user-editable). */
  durationWeeks?: number;
  /**
   * Manual override: which week (0-indexed from plan start) this step begins.
   * If undefined, the timeline derives it from the previous step's end.
   */
  startWeek?: number;
  done: boolean;
  status?: SubStepStatus;
  /** ISO timestamp when marked done — used for "actual vs planned" review. */
  completedAt?: string;
  /** Free-form review note ("hurt knee, slipped a week"). */
  reviewNote?: string;
  /** Ordered log of every status transition. */
  statusHistory?: StatusEvent[];
  /** Quantitative milestone target (e.g. 30 pushups straight). */
  targetMetric?: number;
  /** Current quantitative progress toward `targetMetric`. */
  currentMetric?: number;
  /** Unit label, e.g. "reps", "miles", "wpm", "books". */
  metricUnit?: string;
  /** Free-form structured notes — muscles to train, key principles, anything. */
  notes?: string;
  /** Sub-step-level tags (cross-cuts the goal's tags). */
  tags?: string[];
}

/** Append a status transition if it differs from the most recent one. */
export function appendStatusEvent(
  step: GoalSubStep,
  status: SubStepStatus,
  note?: string,
): StatusEvent[] {
  const history = step.statusHistory ?? [];
  const last = history[history.length - 1];
  if (last && last.status === status) return history;
  return [...history, { status, at: new Date().toISOString(), note }];
}

export interface Goal {
  id: string;
  title: string;
  category: GoalCategory;
  timeframe: GoalTimeframe;
  quarter: GoalQuarter;
  deadline?: string; // ISO date
  target?: number;
  current?: number;
  unit?: string;
  done: boolean;
  note?: string;
  createdAt: number;
  /** AI-generated phased plan. */
  subSteps?: GoalSubStep[];
  /** Butler-style summary that accompanied the plan. */
  planSummary?: string;
  /** ISO date the plan officially kicked off (defaults to plan generation time). */
  planStartDate?: string;
  /** Free-form tags. Cross-cuts categories ("morning", "outdoor", "high-energy"). */
  tags?: string[];
  /** Map of YYYY-MM-DD -> the `current` value as of that day's last check-in. */
  progressLog?: Record<string, number>;
  /** YYYY-MM-DD of the most recent check-in. */
  lastCheckIn?: string;
}

/* ---------- Pace / position helpers ---------- */

export type PaceStatus = "ahead" | "on_track" | "behind" | "no_data";

/**
 * Compare a sub-step's quantitative progress against the share of time elapsed.
 * - "ahead"     → current/target > elapsed/total + 10%
 * - "on_track"  → within ±10%
 * - "behind"    → current/target < elapsed/total - 10%
 *
 * Useful for the "where do I stand?" badge — independent of the binary done/at_risk state.
 */
export function paceStatus(
  step: GoalSubStep,
  elapsedFraction: number,
): PaceStatus {
  if (step.targetMetric == null || step.targetMetric <= 0) return "no_data";
  if (step.currentMetric == null) return "no_data";
  const progress = step.currentMetric / step.targetMetric;
  const expected = Math.min(1, Math.max(0, elapsedFraction));
  const diff = progress - expected;
  if (diff > 0.1) return "ahead";
  if (diff < -0.1) return "behind";
  return "on_track";
}

export const PACE_META: Record<
  PaceStatus,
  { label: string; tone: string }
> = {
  ahead: { label: "Ahead of pace", tone: "text-gold" },
  on_track: { label: "On track", tone: "text-teal" },
  behind: { label: "Falling behind", tone: "text-destructive" },
  no_data: { label: "No metric set", tone: "text-muted-foreground" },
};

/** All unique tags across the goal list — sorted for chip display. */
export function collectTags(goals: Goal[]): string[] {
  const set = new Set<string>();
  for (const g of goals) {
    for (const t of g.tags ?? []) set.add(t);
    for (const s of g.subSteps ?? []) {
      for (const t of s.tags ?? []) set.add(t);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export const CATEGORIES: GoalCategory[] = ["Body", "Career", "Money", "Skills", "Life"];
export const TIMEFRAMES: GoalTimeframe[] = ["daily", "monthly", "quarterly", "annual"];
export const QUARTERS: Exclude<GoalQuarter, null>[] = ["Q1", "Q2", "Q3", "Q4"];

export const QUARTER_RANGES: Record<Exclude<GoalQuarter, null>, { label: string; months: string }> = {
  Q1: { label: "Q1 · Foundation", months: "Jan – Mar" },
  Q2: { label: "Q2 · Build", months: "Apr – Jun" },
  Q3: { label: "Q3 · Push", months: "Jul – Sep" },
  Q4: { label: "Q4 · Conquer", months: "Oct – Dec" },
};

export function quarterFromDate(d: Date): Exclude<GoalQuarter, null> {
  const m = d.getMonth();
  if (m < 3) return "Q1";
  if (m < 6) return "Q2";
  if (m < 9) return "Q3";
  return "Q4";
}

export function progressPct(g: Goal): number {
  if (g.done) return 100;
  if (typeof g.target === "number" && g.target > 0) {
    return Math.min(100, Math.round(((g.current ?? 0) / g.target) * 100));
  }
  return 0;
}

export function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const target = new Date(iso);
  const now = new Date();
  return Math.ceil((+target - +now) / 86_400_000);
}

const SEED: Goal[] = [
  // Body
  { id: "g1", title: "Run a 5K", category: "Body", timeframe: "annual", quarter: "Q2", done: false, createdAt: 0 },
  { id: "g2", title: "Compete in a Hyrox event", category: "Body", timeframe: "annual", quarter: "Q4", done: false, createdAt: 0 },
  { id: "g3", title: "100 push-ups straight", category: "Body", timeframe: "annual", quarter: "Q3", target: 100, current: 0, unit: "reps", done: false, createdAt: 0 },
  { id: "g4", title: "90 days no fap / no porn", category: "Body", timeframe: "quarterly", quarter: "Q1", target: 90, current: 0, unit: "days", done: false, createdAt: 0 },
  { id: "g5", title: "Learn to dance", category: "Body", timeframe: "annual", quarter: "Q3", done: false, createdAt: 0 },

  // Career
  { id: "g6", title: "Get a job", category: "Career", timeframe: "quarterly", quarter: "Q1", done: false, createdAt: 0 },
  { id: "g7", title: "Start a business", category: "Career", timeframe: "annual", quarter: "Q2", done: false, createdAt: 0 },
  { id: "g8", title: "Build a daily schedule", category: "Career", timeframe: "daily", quarter: "Q1", done: false, createdAt: 0 },

  // Money
  { id: "g9", title: "Save $15,000", category: "Money", timeframe: "annual", quarter: "Q4", target: 15000, current: 0, unit: "$", done: false, createdAt: 0 },
  { id: "g10", title: "$3,500+ in stocks", category: "Money", timeframe: "annual", quarter: "Q3", target: 3500, current: 0, unit: "$", done: false, createdAt: 0 },
  { id: "g11", title: "Pay off credit card", category: "Money", timeframe: "quarterly", quarter: "Q2", done: false, createdAt: 0 },
  { id: "g12", title: "$9,000 in checking", category: "Money", timeframe: "annual", quarter: "Q3", target: 9000, current: 0, unit: "$", done: false, createdAt: 0 },

  // Skills
  { id: "g13", title: "Type fluently — 50 WPM", category: "Skills", timeframe: "quarterly", quarter: "Q2", target: 50, current: 0, unit: "wpm", done: false, createdAt: 0 },
  { id: "g14", title: "Read 12 books", category: "Skills", timeframe: "annual", quarter: "Q4", target: 12, current: 0, unit: "books", done: false, createdAt: 0 },
  { id: "g15", title: "Improve writing", category: "Skills", timeframe: "annual", quarter: null, done: false, createdAt: 0 },
  { id: "g16", title: "Learn to sew", category: "Skills", timeframe: "annual", quarter: "Q2", done: false, createdAt: 0 },
  { id: "g17", title: "Learn to build", category: "Skills", timeframe: "annual", quarter: "Q3", done: false, createdAt: 0 },
  { id: "g18", title: "Learn fashion design", category: "Skills", timeframe: "annual", quarter: "Q4", done: false, createdAt: 0 },
  { id: "g19", title: "Master 10 recipes & fill recipe book", category: "Skills", timeframe: "annual", quarter: "Q3", target: 10, current: 0, unit: "recipes", done: false, createdAt: 0 },

  // Life
  { id: "g20", title: "Take a personal trip", category: "Life", timeframe: "annual", quarter: "Q2", done: false, createdAt: 0 },
  { id: "g21", title: "Take a trip with bae", category: "Life", timeframe: "annual", quarter: "Q3", done: false, createdAt: 0 },
  { id: "g22", title: "Get a new phone", category: "Life", timeframe: "annual", quarter: "Q1", done: false, createdAt: 0 },
  { id: "g23", title: "Look for a ring for Kayla", category: "Life", timeframe: "annual", quarter: "Q4", done: false, createdAt: 0 },
];

export const SEED_GOALS = SEED;
export const GOALS_KEY = "alfred.goals2026";
