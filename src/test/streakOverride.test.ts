import { describe, it, expect, beforeEach } from "vitest";
import {
  currentStreakFor,
  derivedStreakFor,
  getStreakOverride,
  setStreakOverride,
  clearStreakOverride,
  purgeHabitMeta,
  buildRecovery,
  type Habit,
  type HabitLog,
} from "@/lib/habits";

const habit: Habit = { id: "h1", title: "Morning stretch", cadence: "daily", createdAt: 0 };
const TODAY = new Date(2026, 8, 15); // Sep 15 2026

// Ticked Sep 13, 14, 15 -> a genuine run of 3.
const logs: HabitLog[] = [
  { habitId: "h1", date: "2026-09-13" },
  { habitId: "h1", date: "2026-09-14" },
  { habitId: "h1", date: "2026-09-15" },
];

beforeEach(() => localStorage.clear());

describe("automatic by default", () => {
  it("counts from the logs with no override set", () => {
    expect(getStreakOverride("h1")).toBeNull();
    expect(currentStreakFor(habit, logs, TODAY)).toBe(3);
    expect(derivedStreakFor(habit, logs, TODAY)).toBe(3);
  });

  it("needs no manual entry to keep counting as ticks arrive", () => {
    const fewer = logs.slice(0, 2); // Sep 13 + 14 only
    expect(currentStreakFor(habit, fewer, new Date(2026, 8, 14))).toBe(2);
    expect(currentStreakFor(habit, logs, TODAY)).toBe(3);
  });
});

describe("manual override", () => {
  it("shows the user's number instead of the counted one", () => {
    setStreakOverride("h1", 45);
    expect(currentStreakFor(habit, logs, TODAY)).toBe(45);
  });

  it("leaves the counted number untouched underneath", () => {
    setStreakOverride("h1", 45);
    expect(derivedStreakFor(habit, logs, TODAY)).toBe(3);
  });

  it("hands counting back when cleared", () => {
    setStreakOverride("h1", 45);
    clearStreakOverride("h1");
    expect(getStreakOverride("h1")).toBeNull();
    expect(currentStreakFor(habit, logs, TODAY)).toBe(3);
  });

  it("accepts zero as a deliberate reset", () => {
    setStreakOverride("h1", 0);
    expect(getStreakOverride("h1")).toBe(0);
    expect(currentStreakFor(habit, logs, TODAY)).toBe(0);
  });

  it("floors fractions and refuses negatives", () => {
    setStreakOverride("h1", 12.7);
    expect(getStreakOverride("h1")).toBe(12);
    setStreakOverride("h1", -5);
    expect(getStreakOverride("h1")).toBe(0);
  });

  it("is per habit, not global", () => {
    const other: Habit = { ...habit, id: "h2" };
    setStreakOverride("h1", 45);
    expect(currentStreakFor(habit, logs, TODAY)).toBe(45);
    expect(currentStreakFor(other, [], TODAY)).toBe(0);
  });

  it("ignores a corrupt stored value and counts instead", () => {
    localStorage.setItem("alfred.habitStreaks", JSON.stringify({ h1: "not a number" }));
    expect(getStreakOverride("h1")).toBeNull();
    expect(currentStreakFor(habit, logs, TODAY)).toBe(3);
  });

  it("is dropped when the habit is deleted", () => {
    setStreakOverride("h1", 45);
    purgeHabitMeta("h1");
    expect(getStreakOverride("h1")).toBeNull();
  });
});

describe("a manual number never silences recovery", () => {
  const stale: HabitLog[] = [{ habitId: "h1", date: "2026-09-01" }];

  it("still flags a habit that has genuinely gone quiet", () => {
    // Claiming a 90-day streak must not convince Alfred the habit is healthy —
    // recovery reads the logs, not the claim.
    setStreakOverride("h1", 90);
    const recovery = buildRecovery(habit, stale, TODAY);
    expect(recovery).not.toBeNull();
  });

  it("stays quiet when the logs really do show a live run", () => {
    setStreakOverride("h1", 90);
    expect(buildRecovery(habit, logs, TODAY)).toBeNull();
  });
});
