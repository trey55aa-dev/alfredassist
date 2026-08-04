// "Do This First" — a single deterministic pick across goals and habits.
//
// Alfred already tracks urgency for habits (buildRecovery/habitsAtRisk) and
// goals (computeProjection) separately, but nothing merges them into one
// answer to "what should I actually do first?" This module does exactly
// that and nothing else — pure, no new urgency math, just a waterfall over
// the existing signals.

import { habitsAtRisk, type Habit, type HabitLog, type Recovery } from "./habits";
import { computeProjection, type ProjectionResult } from "./goalsHistory";
import type { Goal } from "./goals";

export type TodayFocusPick =
  | { kind: "habit"; recovery: Recovery }
  | { kind: "goal"; goal: Goal; projection: ProjectionResult };

/**
 * Most urgent tier wins; ties among goals break toward the soonest deadline.
 *   1. A habit whose streak has actually broken (missedPeriods > 1, past the
 *      one-day grace period) — still compounding, most urgent.
 *   2. A goal that's "behind_critical" pace.
 *   3. A goal that's "behind" pace.
 *   4. A habit just needing today's tick (missedPeriods === 1) — gentle,
 *      nothing broken yet.
 *   5. A goal with no progress logged yet ("missing").
 *   6. Nothing qualifies → null (an all-clear, not an empty state).
 */
export function pickTodayFocus(
  goals: Goal[],
  habits: Habit[],
  habitLogs: HabitLog[],
  now = new Date(),
): TodayFocusPick | null {
  const recoveries = habitsAtRisk(habits, habitLogs, now);
  const brokenHabit = recoveries.find((r) => r.missedPeriods > 1);
  if (brokenHabit) return { kind: "habit", recovery: brokenHabit };

  const openGoals = goals.filter((g) => !g.done);
  const projected = openGoals
    .map((goal) => ({ goal, projection: computeProjection(goal, now) }))
    .filter((p) => p.projection.daysLeft != null);
  const byDeadline = (a: { projection: ProjectionResult }, b: { projection: ProjectionResult }) =>
    (a.projection.daysLeft ?? Infinity) - (b.projection.daysLeft ?? Infinity);

  const critical = projected
    .filter((p) => p.projection.status === "behind_critical")
    .sort(byDeadline)[0];
  if (critical) return { kind: "goal", goal: critical.goal, projection: critical.projection };

  const behind = projected
    .filter((p) => p.projection.status === "behind")
    .sort(byDeadline)[0];
  if (behind) return { kind: "goal", goal: behind.goal, projection: behind.projection };

  const dueTodayHabit = recoveries.find((r) => r.missedPeriods === 1);
  if (dueTodayHabit) return { kind: "habit", recovery: dueTodayHabit };

  const missing = projected
    .filter((p) => p.projection.status === "missing")
    .sort(byDeadline)[0];
  if (missing) return { kind: "goal", goal: missing.goal, projection: missing.projection };

  return null;
}
