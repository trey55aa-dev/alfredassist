import { describe, it, expect } from "vitest";
import { challengeStatus, type ChallengeConfig } from "@/lib/challenge";

const CFG: ChallengeConfig = { title: "35-Day Reset", startDate: "2026-08-08", totalDays: 35 };

describe("challengeStatus", () => {
  it("is upcoming before the start date", () => {
    const s = challengeStatus(CFG, new Date(2026, 7, 5)); // Aug 5
    expect(s.state).toBe("upcoming");
    expect(s.daysUntilStart).toBe(3);
    expect(s.pctElapsed).toBe(0);
  });

  it("is day 1 on the start date itself", () => {
    const s = challengeStatus(CFG, new Date(2026, 7, 8, 23, 59)); // Aug 8, late at night
    expect(s.state).toBe("active");
    expect(s.dayNumber).toBe(1);
  });

  it("counts up correctly mid-challenge", () => {
    const s = challengeStatus(CFG, new Date(2026, 7, 15)); // Aug 15 — 7 days after start
    expect(s.state).toBe("active");
    expect(s.dayNumber).toBe(8);
    expect(s.pctElapsed).toBeCloseTo(8 / 35);
  });

  it("still reads as active — Day 35 of 35 — on the final day itself", () => {
    const lastDay = new Date(2026, 7, 8);
    lastDay.setDate(lastDay.getDate() + 34); // 34 days after Aug 8 = day 35
    const s = challengeStatus(CFG, lastDay);
    expect(s.state).toBe("active");
    expect(s.dayNumber).toBe(35);
    expect(s.pctElapsed).toBe(1);
  });

  it("flips to complete starting the day after the final day, clamped at totalDays", () => {
    const dayAfter = new Date(2026, 7, 8);
    dayAfter.setDate(dayAfter.getDate() + 35);
    const s1 = challengeStatus(CFG, dayAfter);
    expect(s1.state).toBe("complete");
    expect(s1.dayNumber).toBe(35);

    const wayAfter = new Date(2026, 9, 1); // Oct 1 — long past the end
    const s2 = challengeStatus(CFG, wayAfter);
    expect(s2.state).toBe("complete");
    expect(s2.dayNumber).toBe(35);
    expect(s2.pctElapsed).toBe(1);
  });
});
