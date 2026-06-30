// Builds the context block Alfred sends to Gemini with every message.
// Reads from localStorage so it's always up-to-date without prop drilling.

import { todayKey } from "./alfred";
import { GOALS_KEY, type Goal } from "./goals";
import {
  HABITS_KEY,
  HABIT_LOGS_KEY,
  isCompleteForPeriod,
  loadHabitNotes,
  loadHabitTimes,
  type Habit,
  type HabitLog,
} from "./habits";
import { computeHabitStats, WEEKDAY_SHORT, formatHour } from "./habitStats";
import { STREAK_KEY, type StreakState, currentStreak, emptyStreak } from "./streak";
import {
  WEEKLY_PLAN_KEY,
  type WeeklyPlan,
  PLAN_DAYS,
  cellKey,
  dowToPlanDay,
} from "./weeklyPlan";
import { levelFromXp } from "./gamification";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function pct(current: number, target: number) {
  return Math.min(100, Math.round((current / target) * 100));
}

export function buildContext(): string {
  const today = todayKey();
  const now = new Date();
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const todayPlanIdx = dowToPlanDay(now.getDay());

  // ── Goals ──
  const goals: Goal[] = read(GOALS_KEY, []);
  const activeGoals = goals.filter((g) => !g.done);

  const goalLines = activeGoals.slice(0, 10).map((g) => {
    const parts: string[] = [`- [${g.category}] ${g.title}`];
    if (typeof g.target === "number" && g.target > 0) {
      parts.push(
        `(${pct(g.current ?? 0, g.target)}% — ${g.current ?? 0}/${g.target}${g.unit ? " " + g.unit : ""})`,
      );
    }
    if (g.deadline) parts.push(`due ${g.deadline}`);
    const s = g.survey;
    if (s?.vision) parts.push(`| done = ${s.vision}`);
    if (s?.breakdown) parts.push(`| breakdown: ${s.breakdown}`);
    if (s?.missRule) parts.push(`| misses: ${s.missRule}`);
    if (s?.ifReached) parts.push(`| reward: ${s.ifReached}`);
    if (s?.ifMissed) parts.push(`| if missed: ${s.ifMissed}`);
    return parts.join(" ");
  });

  // ── Habits ──
  const habits: Habit[] = read<Habit[]>(HABITS_KEY, []).filter((h) => !h.archived);
  const logs: HabitLog[] = read(HABIT_LOGS_KEY, []);
  const dailyHabits = habits.filter((h) => h.cadence === "daily");
  const doneDailyCount = dailyHabits.filter((h) => isCompleteForPeriod(h, logs)).length;
  const habitLines = dailyHabits.map(
    (h) => `- [${isCompleteForPeriod(h, logs) ? "x" : " "}] ${h.title}`,
  );

  // ── Habit patterns + user comments (grounds coaching) ──
  const habitNotes = loadHabitNotes();
  const habitTimes = loadHabitTimes();
  const patternLines = dailyHabits.slice(0, 12).map((h) => {
    const st = computeHabitStats(h, logs, habitTimes);
    const bits = [`- ${h.title}: streak ${st.current}, best ${st.longest}, year ${st.yearPct}% (${st.totalMisses} misses)`];
    if (st.totalMisses > 0 && st.worstWeekday != null) bits.push(`misses most on ${WEEKDAY_SHORT[st.worstWeekday]}`);
    if (st.peakHour != null) bits.push(`usually checks in ${formatHour(st.peakHour)}`);
    return bits.join(" · ");
  });
  const noteLines = habits
    .filter((h) => habitNotes[h.id])
    .map((h) => `- ${h.title}: "${habitNotes[h.id]}"`);

  // ── Streak ──
  const streakState: StreakState = read(STREAK_KEY, emptyStreak);
  const streak = currentStreak(streakState);

  // ── Gamification ──
  const gami = read<{ xp: number }>( "alfred.gamification", { xp: 0 });
  const lvl = levelFromXp(gami.xp);

  // ── Focus (today's session stats) ──
  const focus = read<{ date?: string; sessions?: number; minutes?: number }>(
    "alfred.focus.stats",
    {},
  );
  const focusToday =
    focus.date === today ? { sessions: focus.sessions ?? 0, minutes: focus.minutes ?? 0 } : { sessions: 0, minutes: 0 };

  // ── Weekly plan — today's items ──
  const plan: WeeklyPlan = read(WEEKLY_PLAN_KEY, { areas: [], items: {} });
  const todayPlanLines: string[] = [];
  for (const area of plan.areas) {
    const items = plan.items[cellKey(area.id, todayPlanIdx)] ?? [];
    for (const item of items) {
      todayPlanLines.push(`- [${item.done ? "x" : " "}] ${area.name}: ${item.text}`);
    }
  }

  // ── Brain dump ──
  const brain = read<string[]>("alfred.brain", []);
  const brainSnippet = brain
    .slice(0, 5)
    .map((b) => `- ${b}`)
    .join("\n");

  const lines = [
    `Date: ${today} (${dayName})`,
    `Level: ${lvl.level} · ${lvl.title} — ${gami.xp} XP`,
    "",
    "=== YEARLY GOALS ===",
    activeGoals.length === 0
      ? "No active goals."
      : goalLines.join("\n"),
    "",
    `=== HABITS — TODAY (${doneDailyCount}/${dailyHabits.length} daily done) ===`,
    habitLines.length > 0 ? habitLines.join("\n") : "No daily habits set.",
    "",
    "=== HABIT PATTERNS (daily) ===",
    patternLines.length > 0 ? patternLines.join("\n") : "No daily habits tracked yet.",
    "",
    "=== HABIT COMMENTS (the user's own words — use these to coach) ===",
    noteLines.length > 0 ? noteLines.join("\n") : "No comments yet.",
    "",
    `=== STREAK ===`,
    `${streak} consecutive day${streak === 1 ? "" : "s"}`,
    "",
    "=== FOCUS TODAY ===",
    `${focusToday.sessions} session${focusToday.sessions === 1 ? "" : "s"}, ${focusToday.minutes} min`,
    "",
    "=== TODAY'S PLAN ===",
    todayPlanLines.length > 0 ? todayPlanLines.join("\n") : "Nothing in the planner for today.",
    "",
    "=== BRAIN DUMP (recent items) ===",
    brainSnippet || "Empty.",
  ];

  return lines.join("\n");
}
