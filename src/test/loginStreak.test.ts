import { describe, it, expect, beforeEach } from "vitest";
import {
  getLoginDays,
  recordLogin,
  loginStreakFrom,
} from "@/lib/loginStreak";
import { mergeArrays } from "@/hooks/useCloudStateSync";

const NOW = new Date(2026, 8, 15); // Sep 15 2026

describe("loginStreakFrom", () => {
  it("is zero before the user has ever opened the app", () => {
    expect(loginStreakFrom([], NOW)).toEqual({ current: 0, best: 0 });
  });

  it("counts consecutive days ending today", () => {
    const days = ["2026-09-13", "2026-09-14", "2026-09-15"];
    expect(loginStreakFrom(days, NOW)).toEqual({ current: 3, best: 3 });
  });

  it("keeps the run alive on yesterday's anchor before today is recorded", () => {
    // Grace before penalty: opening yesterday and not yet today isn't a break.
    const days = ["2026-09-13", "2026-09-14"];
    expect(loginStreakFrom(days, NOW).current).toBe(2);
  });

  it("breaks once a whole day has actually been missed", () => {
    // Last seen Sep 13 — Sep 14 was missed entirely.
    const days = ["2026-09-12", "2026-09-13"];
    expect(loginStreakFrom(days, NOW).current).toBe(0);
  });

  it("remembers the best run even after the current one breaks", () => {
    const days = [
      "2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", // run of 4
      "2026-09-14", "2026-09-15", // current run of 2
    ];
    expect(loginStreakFrom(days, NOW)).toEqual({ current: 2, best: 4 });
  });

  it("is unfazed by duplicates and out-of-order days", () => {
    const days = ["2026-09-15", "2026-09-13", "2026-09-14", "2026-09-14"];
    expect(loginStreakFrom(days, NOW)).toEqual({ current: 3, best: 3 });
  });

  it("counts a single day as a run of one", () => {
    expect(loginStreakFrom(["2026-09-15"], NOW)).toEqual({ current: 1, best: 1 });
  });

  it("counts across a month boundary", () => {
    const days = ["2026-08-30", "2026-08-31", "2026-09-01"];
    expect(loginStreakFrom(days, new Date(2026, 8, 1)).current).toBe(3);
  });
});

describe("recordLogin", () => {
  beforeEach(() => localStorage.clear());

  it("records today once, however many times the app opens", () => {
    recordLogin(NOW);
    recordLogin(NOW);
    recordLogin(NOW);
    expect(getLoginDays()).toEqual(["2026-09-15"]);
  });

  it("appends each new day in order", () => {
    recordLogin(new Date(2026, 8, 14));
    recordLogin(NOW);
    expect(getLoginDays()).toEqual(["2026-09-14", "2026-09-15"]);
    expect(loginStreakFrom(getLoginDays(), NOW).current).toBe(2);
  });

  it("survives a corrupt stored value", () => {
    localStorage.setItem("alfred.loginStreak", "{not json");
    recordLogin(NOW);
    expect(getLoginDays()).toEqual(["2026-09-15"]);
  });
});

describe("cross-device merge", () => {
  it("unions days opened on different devices instead of clobbering", () => {
    // Phone opened Mon+Tue, laptop opened Tue+Wed — neither device loses a day.
    const phone = ["2026-09-13", "2026-09-14"];
    const laptop = ["2026-09-14", "2026-09-15"];
    const merged = mergeArrays(phone, laptop, true) as string[];
    expect([...merged].sort()).toEqual(["2026-09-13", "2026-09-14", "2026-09-15"]);
    expect(loginStreakFrom(merged, NOW).current).toBe(3);
  });
});
