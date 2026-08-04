// Month Overview — one combined color per day across every habit and goal,
// for the current month, past days graded on what happened, future days
// graded on a projection.
//
// Habits don't have a "pace" concept anywhere in this codebase (they're a
// daily tick, not a cumulative target), so projecting future habit
// completion would mean inventing a forecast Alfred can't back up. Future
// days are therefore graded on goal pace projection only; habits contribute
// to past/today grading (a real miss is unambiguous), never to the future.

import { monthCells } from "./habitStats";
import type { Habit, HabitLog } from "./habits";
import { computeProjection, paceTargetByDate } from "./goalsHistory";
import { todayKey } from "./alfred";
import type { Goal } from "./goals";

export type DayTone = "ahead" | "on_pace" | "behind" | "behind_critical" | "no_data";

export interface MonthDayStatus {
  date: Date;
  ymd: string;
  inMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  tone: DayTone;
  reason: string;
}

const SEVERITY: Record<DayTone, number> = {
  behind_critical: 0,
  behind: 1,
  on_pace: 2,
  ahead: 3,
  no_data: 4,
};

const MS_PER_DAY = 86_400_000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Same ratio bands `computeProjection` uses, so the whole app's pace
 *  vocabulary stays consistent. `paceTarget <= 0` means nothing was expected
 *  yet (e.g. day one of a goal) — any real progress is a bonus, no progress
 *  is simply "no signal" rather than a manufactured miss. */
function goalDayTone(paceTarget: number, actualValue: number): DayTone | null {
  if (paceTarget <= 0) return actualValue > 0 ? "ahead" : null;
  const ratio = actualValue / paceTarget;
  if (ratio >= 1.1) return "ahead";
  if (ratio >= 0.9) return "on_pace";
  if (ratio >= 0.6) return "behind";
  return "behind_critical";
}

const TONE_LABEL: Record<DayTone, string> = {
  ahead: "Ahead of pace",
  on_pace: "On pace",
  behind: "Behind pace",
  behind_critical: "Well behind pace",
  no_data: "",
};

interface Signal {
  tone: DayTone;
  reason: string;
}

function worst(signals: Signal[]): Signal {
  if (signals.length === 0) return { tone: "no_data", reason: "" };
  return signals.reduce((a, b) => (SEVERITY[b.tone] < SEVERITY[a.tone] ? b : a));
}

export function computeMonthOverview(
  goals: Goal[],
  habits: Habit[],
  habitLogs: HabitLog[],
  habitTimes: Record<string, number>,
  year: number,
  month: number,
  now = new Date(),
): MonthDayStatus[] {
  const todayY = todayKey(now);
  const today0 = startOfDay(now);

  const dailyHabits = habits.filter((h) => !h.archived && h.cadence === "daily");
  const habitGrids = dailyHabits.map((h) => ({
    habit: h,
    cells: monthCells(h, habitLogs, habitTimes, year, month, now),
  }));

  const measurableGoals = goals.filter(
    (g) => !g.done && typeof g.target === "number" && (g.target ?? 0) > 0,
  );
  const goalRates = measurableGoals.map((g) => ({
    goal: g,
    actualDailyRate: computeProjection(g, now).actualDailyRate,
  }));

  // Reuse the habit grid's own 42-cell layout — same convention, so the
  // combined calendar lines up with the per-habit one.
  const layout =
    habitGrids[0]?.cells ??
    monthCells(
      { id: "__layout__", title: "", cadence: "daily", createdAt: now.getTime() },
      [],
      {},
      year,
      month,
      now,
    );

  return layout.map((cell) => {
    const { date, ymd, inMonth } = cell;
    const isToday = ymd === todayY;
    const isFuture = ymd > todayY;
    const signals: Signal[] = [];

    if (!isFuture) {
      for (const { habit, cells } of habitGrids) {
        const dayCell = cells.find((c) => c.ymd === ymd);
        if (dayCell?.state === "missed") {
          signals.push({ tone: "behind_critical", reason: `${habit.title} missed` });
        }
      }
      for (const goal of measurableGoals) {
        const logged = goal.progressLog?.[ymd];
        if (logged === undefined) continue;
        const target = paceTargetByDate(goal, date);
        const tone = target == null ? null : goalDayTone(target, logged);
        if (tone) signals.push({ tone, reason: `${goal.title} — ${TONE_LABEL[tone]}` });
      }
    } else {
      for (const { goal, actualDailyRate } of goalRates) {
        if (actualDailyRate == null || !isFinite(actualDailyRate)) continue;
        const daysOut = Math.round((date.getTime() - today0.getTime()) / MS_PER_DAY);
        const projected = (goal.current ?? 0) + actualDailyRate * daysOut;
        const target = paceTargetByDate(goal, date);
        const tone = target == null ? null : goalDayTone(target, projected);
        if (tone) {
          signals.push({ tone, reason: `${goal.title} — projected: ${TONE_LABEL[tone].toLowerCase()}` });
        }
      }
    }

    const pick = worst(signals);
    return { date, ymd, inMonth, isToday, isFuture, tone: pick.tone, reason: pick.reason };
  });
}
