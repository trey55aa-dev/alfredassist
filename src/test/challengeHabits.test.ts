// A challenge isn't limited to one goal's daily habits: it can hold a
// hand-picked set that shares nothing but the month you're doing them in.

import { describe, it, expect } from "vitest";
import {
  challengeHabits,
  challengeGoalLabel,
  hasPickedHabits,
  computeAdherence,
  type ChallengeConfig,
} from "@/lib/challenge";
import type { Habit, HabitLog } from "@/lib/habits";

const BASE: ChallengeConfig = { title: "30-Day Reinvention", startDate: "2026-09-01", totalDays: 30 };

const wakeEarly: Habit = { id: "h1", title: "Wake at 6", cadence: "daily", createdAt: 0 };
const workout: Habit = { id: "h2", title: "Workout", cadence: "weekly", createdAt: 0, goalId: "g1" };
const earlyBed: Habit = { id: "h3", title: "Lights out by 10", cadence: "daily", createdAt: 0 };
const hobby: Habit = { id: "h4", title: "Guitar", cadence: "daily", createdAt: 0, goalId: "g2" };
const archived: Habit = { id: "h5", title: "Old thing", cadence: "daily", createdAt: 0, archived: true };
const ALL = [wakeEarly, workout, earlyBed, hobby, archived];

describe("hand-picked habits", () => {
  it("tracks exactly the habits chosen, across goals and cadences", () => {
    const cfg: ChallengeConfig = { ...BASE, habitIds: ["h1", "h2", "h3", "h4"] };
    expect(challengeHabits(cfg, ALL).map((h) => h.title)).toEqual([
      "Wake at 6", "Workout", "Lights out by 10", "Guitar",
    ]);
  });

  it("keeps them in the order they were picked", () => {
    const cfg: ChallengeConfig = { ...BASE, habitIds: ["h4", "h1"] };
    expect(challengeHabits(cfg, ALL).map((h) => h.id)).toEqual(["h4", "h1"]);
  });

  it("outranks a linked goal", () => {
    const cfg: ChallengeConfig = { ...BASE, goalId: "g1", habitIds: ["h4"] };
    expect(challengeHabits(cfg, ALL).map((h) => h.id)).toEqual(["h4"]);
  });

  it("silently drops an archived or deleted habit rather than breaking", () => {
    const cfg: ChallengeConfig = { ...BASE, habitIds: ["h1", "h5", "gone"] };
    expect(challengeHabits(cfg, ALL).map((h) => h.id)).toEqual(["h1"]);
  });

  it("falls back to the old behaviour when nothing is picked", () => {
    expect(hasPickedHabits(BASE)).toBe(false);
    // No goal, no picks -> every non-archived daily habit.
    expect(challengeHabits(BASE, ALL).map((h) => h.id)).toEqual(["h1", "h3", "h4"]);
    // Goal linked -> that goal's daily habits only.
    expect(challengeHabits({ ...BASE, goalId: "g2" }, ALL).map((h) => h.id)).toEqual(["h4"]);
  });

  it("treats an empty pick list as no pick at all", () => {
    const cfg: ChallengeConfig = { ...BASE, habitIds: [] };
    expect(hasPickedHabits(cfg)).toBe(false);
    expect(challengeHabits(cfg, ALL).map((h) => h.id)).toEqual(["h1", "h3", "h4"]);
  });
});

describe("what the challenge is for", () => {
  const goals = [{ id: "g1", title: "Run a 5K" }];

  it("prefers a written-in reason over a goal row", () => {
    const cfg: ChallengeConfig = { ...BASE, goalId: "g1", customGoal: "Get my mornings back" };
    expect(challengeGoalLabel(cfg, goals)).toBe("Get my mornings back");
  });

  it("falls back to the linked goal's title", () => {
    expect(challengeGoalLabel({ ...BASE, goalId: "g1" }, goals)).toBe("Run a 5K");
  });

  it("is null when there's neither", () => {
    expect(challengeGoalLabel(BASE, goals)).toBeNull();
  });

  it("ignores a blank custom goal", () => {
    expect(challengeGoalLabel({ ...BASE, customGoal: "   ", goalId: "g1" }, goals)).toBe("Run a 5K");
  });
});

describe("adherence over a mixed-cadence pick", () => {
  // Sep 1 2026 is a Tuesday, so Sep 1–7 covers 7 days but straddles two
  // weeks: Aug 31–Sep 6, then Sep 7 onwards.
  const week = new Date(2026, 8, 7);

  it("counts a weekly habit once a week, not once a day", () => {
    const cfg: ChallengeConfig = { ...BASE, habitIds: ["h2"] };
    const logs: HabitLog[] = [{ habitId: "h2", date: "2026-09-02" }];
    const r = computeAdherence(cfg, ALL, logs, [], {}, week);
    // Two weekly chances in range, one taken — not 1-of-7 or 7 misses.
    expect(r.applicable).toBe(2);
    expect(r.completed).toBe(1);
    expect(r.pct).toBe(0.5);
  });

  it("still counts a daily habit once per day", () => {
    const cfg: ChallengeConfig = { ...BASE, habitIds: ["h1"] };
    const logs: HabitLog[] = [
      { habitId: "h1", date: "2026-09-01" },
      { habitId: "h1", date: "2026-09-02" },
    ];
    const r = computeAdherence(cfg, ALL, logs, [], {}, week);
    expect(r.applicable).toBe(7);
    expect(r.completed).toBe(2);
  });

  it("adds daily and weekly chances together for a mixed pick", () => {
    const cfg: ChallengeConfig = { ...BASE, habitIds: ["h1", "h2"] };
    const logs: HabitLog[] = [{ habitId: "h2", date: "2026-09-02" }];
    const r = computeAdherence(cfg, ALL, logs, [], {}, week);
    expect(r.applicable).toBe(9); // 7 daily chances + 2 weekly
    expect(r.completed).toBe(1);
  });

  it("leaves recurring blocks out once habits are hand-picked", () => {
    const cfg: ChallengeConfig = { ...BASE, habitIds: ["h1"] };
    const template = {
      id: "t1", title: "Standup", startTime: "09:00", endTime: "09:15",
      recurrence: "daily" as const, days: [], enabled: true,
    };
    const r = computeAdherence(cfg, ALL, [], [template], {}, week);
    expect(r.applicable).toBe(7); // the daily habit only — no template days
  });
});
