import { describe, it, expect } from "vitest";
import { challengeReset, type ChallengeConfig } from "@/lib/challenge";
import type { Habit, HabitLog } from "@/lib/habits";

const dailyHabit: Habit = { id: "h1", title: "Drink water", cadence: "daily", createdAt: 0 };
const CFG: ChallengeConfig = { title: "30-Day Reset", startDate: "2026-08-01", totalDays: 30, resetAfterMisses: 3 };

function logsFor(doneDates: string[]): HabitLog[] {
  return doneDates.map((date) => ({ habitId: "h1", date }));
}

describe("challengeReset", () => {
  it("never resets when resetAfterMisses is unset", () => {
    const cfg: ChallengeConfig = { ...CFG, resetAfterMisses: undefined };
    const r = challengeReset(cfg, [dailyHabit], [], [], {}, new Date(2026, 7, 10));
    expect(r.effectiveStart).toBe(cfg.startDate);
    expect(r.resetCount).toBe(0);
  });

  it("keeps the original start when the miss streak never reaches the threshold", () => {
    // Aug 1-9: done every day except two isolated misses (Aug 3, Aug 6) — never 3 in a row.
    const done = ["2026-08-01", "2026-08-02", "2026-08-04", "2026-08-05", "2026-08-07", "2026-08-08", "2026-08-09"];
    const r = challengeReset(CFG, [dailyHabit], logsFor(done), [], {}, new Date(2026, 7, 10));
    expect(r.effectiveStart).toBe("2026-08-01");
    expect(r.resetCount).toBe(0);
  });

  it("resets to the day after 3 consecutive fully-blank days", () => {
    // Aug 1-2 done, Aug 3-5 blank (3 in a row -> reset), Aug 6 onward done.
    const done = ["2026-08-01", "2026-08-02", "2026-08-06", "2026-08-07", "2026-08-08", "2026-08-09"];
    const r = challengeReset(CFG, [dailyHabit], logsFor(done), [], {}, new Date(2026, 7, 10));
    expect(r.effectiveStart).toBe("2026-08-06");
    expect(r.resetCount).toBe(1);
  });

  it("a partial day (something done) never counts as blank, even under target", () => {
    const other: Habit = { id: "h2", title: "Read", cadence: "daily", createdAt: 0 };
    // Aug 3-5: h1 blank every day, but h2 done every day -> never a fully-blank day.
    // "now" = Aug 6, so only Aug 1-5 are fully-elapsed and walked.
    const logs = [...logsFor(["2026-08-01", "2026-08-02"]), ...["2026-08-03", "2026-08-04", "2026-08-05"].map((d) => ({ habitId: "h2", date: d }))];
    const r = challengeReset(CFG, [dailyHabit, other], logs, [], {}, new Date(2026, 7, 6));
    expect(r.resetCount).toBe(0);
    expect(r.effectiveStart).toBe("2026-08-01");
  });

  it("never judges today, even if today is blank so far (grace before penalty)", () => {
    const done = ["2026-08-01", "2026-08-02", "2026-08-03"];
    // Aug 4-6 (today) have nothing logged; only Aug 4-5 are fully elapsed = 2 blank days, not 3.
    const r = challengeReset(CFG, [dailyHabit], logsFor(done), [], {}, new Date(2026, 7, 6));
    expect(r.resetCount).toBe(0);
    expect(r.currentMissStreak).toBe(2);
    expect(r.effectiveStart).toBe("2026-08-01");
  });

  it("can reset more than once across a long enough gap", () => {
    // Aug 1 done, Aug 2-4 blank (reset -> Aug 5), Aug 5 done, Aug 6-8 blank (reset -> Aug 9), Aug 9 done.
    const done = ["2026-08-01", "2026-08-05", "2026-08-09"];
    const r = challengeReset(CFG, [dailyHabit], logsFor(done), [], {}, new Date(2026, 7, 10));
    expect(r.resetCount).toBe(2);
    expect(r.effectiveStart).toBe("2026-08-09");
  });

  it("treats an auto-mode habit as presumed done, so it never forces a blank day on its own", () => {
    const autoHabit: Habit = { id: "h3", title: "No smoking", cadence: "daily", createdAt: 0, habitMode: "auto" };
    // No logs at all for the auto-mode habit — it's presumed done every day, so nothing resets.
    const r = challengeReset(CFG, [autoHabit], [], [], {}, new Date(2026, 7, 10));
    expect(r.resetCount).toBe(0);
    expect(r.effectiveStart).toBe("2026-08-01");
  });
});
