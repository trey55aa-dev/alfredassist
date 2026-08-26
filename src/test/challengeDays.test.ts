import { describe, it, expect } from "vitest";
import { challengeDays, challengeSlippedDays, type ChallengeConfig } from "@/lib/challenge";
import { canEditDate, countBackfillsInRange, backfillKey } from "@/lib/habitBackfill";
import type { Habit, HabitLog } from "@/lib/habits";

const cfg: ChallengeConfig = { title: "30-Day Hard", startDate: "2026-08-20", totalDays: 30 };
const NOW = new Date(2026, 7, 25, 12, 0, 0); // Aug 25 — day 6

const habits: Habit[] = [
  { id: "h1", title: "Read 10 pages", cadence: "daily", createdAt: 0 },
  { id: "h2", title: "Workout", cadence: "daily", createdAt: 0 },
];

function logsFor(pairs: [string, string][]): HabitLog[] {
  return pairs.map(([habitId, date]) => ({ habitId, date }));
}

describe("challengeDays", () => {
  it("covers exactly the challenge length and numbers days from 1", () => {
    const days = challengeDays(cfg, habits, [], [], {}, NOW);
    expect(days).toHaveLength(30);
    expect(days[0]).toMatchObject({ date: "2026-08-20", dayNumber: 1 });
    expect(days[29].dayNumber).toBe(30);
  });

  it("marks a fully-ticked past day complete and an untouched one missed", () => {
    const logs = logsFor([
      ["h1", "2026-08-20"],
      ["h2", "2026-08-20"],
    ]);
    const days = challengeDays(cfg, habits, logs, [], {}, NOW);
    expect(days[0].status).toBe("complete");
    expect(days[1].status).toBe("missed"); // Aug 21, nothing logged
  });

  it("marks a half-done past day partial, not missed", () => {
    const days = challengeDays(cfg, habits, logsFor([["h1", "2026-08-21"]]), [], {}, NOW);
    const aug21 = days.find((d) => d.date === "2026-08-21")!;
    expect(aug21.status).toBe("partial");
    expect(aug21.completed).toBe(1);
    expect(aug21.applicable).toBe(2);
  });

  it("never calls today or a future day missed (grace before penalty)", () => {
    const days = challengeDays(cfg, habits, [], [], {}, NOW);
    expect(days.find((d) => d.date === "2026-08-25")!.status).toBe("today");
    expect(days.find((d) => d.date === "2026-08-26")!.status).toBe("future");
    expect(challengeSlippedDays(days).every((d) => d.date < "2026-08-25")).toBe(true);
  });

  it("only reports days that have fully passed as slipped", () => {
    const days = challengeDays(cfg, habits, [], [], {}, NOW);
    // Aug 20-24 have passed with nothing logged; Aug 25 is today.
    expect(challengeSlippedDays(days).map((d) => d.date)).toEqual([
      "2026-08-20",
      "2026-08-21",
      "2026-08-22",
      "2026-08-23",
      "2026-08-24",
    ]);
  });
});

describe("backfill guards", () => {
  it("refuses days outside the challenge or not yet finished", () => {
    expect(canEditDate("2026-08-22", cfg.startDate, "2026-08-25")).toBe(true);
    expect(canEditDate("2026-08-25", cfg.startDate, "2026-08-25")).toBe(false); // today
    expect(canEditDate("2026-08-26", cfg.startDate, "2026-08-25")).toBe(false); // future
    expect(canEditDate("2026-08-19", cfg.startDate, "2026-08-25")).toBe(false); // pre-start
  });

  it("counts only backfills inside the range being reported on", () => {
    const ledger = {
      [backfillKey("h1", "2026-08-21")]: 1,
      [backfillKey("h2", "2026-08-21")]: 2,
      [backfillKey("h1", "2026-07-01")]: 3, // before the challenge
    };
    expect(countBackfillsInRange(ledger, "2026-08-20", "2026-09-18")).toBe(2);
  });
});
