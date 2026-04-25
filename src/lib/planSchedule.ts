// Adaptive scheduling for AI-generated sub-step plans.
// Re-flows step start/end weeks based on:
//   - manual startWeek / durationWeeks overrides
//   - actual completion times (slips push downstream)
//   - "today" position vs plan start (at-risk detection)

import type { Goal, GoalSubStep, SubStepStatus } from "./goals";

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export interface ScheduledStep {
  step: GoalSubStep;
  index: number;
  /** Planned start week, 0-indexed from plan start. */
  startWeek: number;
  /** Planned end week (exclusive). */
  endWeek: number;
  duration: number;
  /** Derived status considering today vs plan. */
  status: SubStepStatus;
  /** Weeks of slip vs original sequential plan (positive = late). */
  slip: number;
}

export interface ScheduleResult {
  steps: ScheduledStep[];
  /** Total weeks the plan now spans. */
  totalWeeks: number;
  /** Weeks elapsed since plan start (clamped 0..totalWeeks). */
  elapsedWeeks: number;
  /** Date the plan started. */
  startDate: Date;
  /** Projected completion date based on current pace + remaining work. */
  projectedEndDate: Date;
  /** True when projection runs past goal.deadline. */
  isLate: boolean;
  /** Days late (negative = early) vs deadline. */
  daysVsDeadline: number | null;
  /** Actual avg weeks per completed step (null if none done). */
  actualPace: number | null;
  /** Original planned avg weeks per step. */
  plannedPace: number;
}

export function getPlanStart(goal: Goal): Date {
  if (goal.planStartDate) return new Date(goal.planStartDate);
  if (goal.createdAt) return new Date(goal.createdAt);
  return new Date();
}

export function buildSchedule(goal: Goal, now: Date = new Date()): ScheduleResult {
  const steps = goal.subSteps ?? [];
  const startDate = getPlanStart(goal);
  const elapsedRaw = (now.getTime() - startDate.getTime()) / MS_PER_WEEK;

  // First pass: lay out steps using overrides + sequential fallback
  let cursor = 0;
  const baseLayout = steps.map((s, i) => {
    const dur = Math.max(0.5, s.durationWeeks ?? 1);
    const start = s.startWeek != null ? Math.max(0, s.startWeek) : cursor;
    const end = start + dur;
    cursor = end;
    return { step: s, index: i, startWeek: start, endWeek: end, duration: dur };
  });

  // Second pass: apply slip — if a previous step finished late or is overdue, push later steps
  const scheduled: ScheduledStep[] = [];
  let runningSlip = 0;

  for (const item of baseLayout) {
    const { step } = item;
    let actualEnd = item.endWeek;
    let slip = 0;

    if (step.done && step.completedAt) {
      // Actual end = weeks between plan start and completion
      const actualWeeks =
        (new Date(step.completedAt).getTime() - startDate.getTime()) / MS_PER_WEEK;
      actualEnd = Math.max(item.startWeek + 0.25, actualWeeks);
      slip = actualEnd - item.endWeek;
    } else if (!step.done && elapsedRaw > item.endWeek) {
      // Overdue and still open — slip = how late we already are
      slip = elapsedRaw - item.endWeek;
    }

    const adjStart = item.startWeek + runningSlip;
    const adjEnd = adjStart + item.duration + Math.max(0, slip);

    // Derive status
    let status: SubStepStatus = step.status ?? "pending";
    if (step.done) status = "done";
    else if (step.status === "blocked") status = "blocked";
    else if (elapsedRaw >= adjEnd) status = "at_risk";
    else if (elapsedRaw >= adjStart) status = "in_progress";
    else status = "pending";

    scheduled.push({
      step,
      index: item.index,
      startWeek: adjStart,
      endWeek: adjEnd,
      duration: item.duration,
      status,
      slip: Math.max(0, slip),
    });

    runningSlip += Math.max(0, slip);
  }

  const totalWeeks = Math.max(1, scheduled[scheduled.length - 1]?.endWeek ?? 1);
  const elapsedWeeks = Math.max(0, Math.min(totalWeeks, elapsedRaw));

  // Pace calc
  const completed = scheduled.filter((s) => s.step.done);
  let actualPace: number | null = null;
  if (completed.length > 0) {
    const totalActual = completed.reduce((acc, s) => acc + s.duration + s.slip, 0);
    actualPace = totalActual / completed.length;
  }
  const plannedPace =
    baseLayout.reduce((acc, s) => acc + s.duration, 0) / Math.max(1, baseLayout.length);

  // Projected end: completed steps fixed, remaining steps inflated by pace ratio
  const paceRatio = actualPace && plannedPace ? actualPace / plannedPace : 1;
  const remaining = scheduled.filter((s) => !s.step.done);
  const remainingWeeks = remaining.reduce(
    (acc, s) => acc + s.duration * paceRatio,
    0,
  );

  // Anchor projection from "now" or last completion (whichever is later)
  const lastDoneEnd = completed.length
    ? Math.max(...completed.map((s) => s.endWeek))
    : 0;
  const projectionAnchor = Math.max(elapsedWeeks, lastDoneEnd);
  const projectedTotalWeeks = projectionAnchor + remainingWeeks;
  const projectedEndDate = new Date(
    startDate.getTime() + projectedTotalWeeks * MS_PER_WEEK,
  );

  let isLate = false;
  let daysVsDeadline: number | null = null;
  if (goal.deadline) {
    const deadline = new Date(goal.deadline);
    daysVsDeadline = Math.round(
      (projectedEndDate.getTime() - deadline.getTime()) / (24 * 60 * 60 * 1000),
    );
    isLate = daysVsDeadline > 0;
  }

  return {
    steps: scheduled,
    totalWeeks: Math.max(totalWeeks, projectedTotalWeeks),
    elapsedWeeks,
    startDate,
    projectedEndDate,
    isLate,
    daysVsDeadline,
    actualPace,
    plannedPace,
  };
}

export const STATUS_META: Record<
  SubStepStatus,
  { label: string; tint: string; barClass: string }
> = {
  pending: {
    label: "Pending",
    tint: "text-muted-foreground",
    barClass: "bg-gradient-to-r from-gold/15 to-gold/5 border-gold/25",
  },
  in_progress: {
    label: "In progress",
    tint: "text-teal",
    barClass: "bg-gradient-to-r from-teal/30 to-teal/10 border-teal/40",
  },
  done: {
    label: "Done",
    tint: "text-gold",
    barClass: "bg-gold/30 border-gold/50",
  },
  at_risk: {
    label: "At risk",
    tint: "text-destructive",
    barClass: "bg-gradient-to-r from-destructive/30 to-destructive/10 border-destructive/40",
  },
  blocked: {
    label: "Blocked",
    tint: "text-destructive",
    barClass: "bg-destructive/20 border-destructive/50",
  },
};
