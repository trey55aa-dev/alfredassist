export type GoalCategory = "Body" | "Career" | "Money" | "Skills" | "Life";
export type GoalTimeframe = "daily" | "monthly" | "quarterly" | "annual";
export type GoalQuarter = "Q1" | "Q2" | "Q3" | "Q4" | null;

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
