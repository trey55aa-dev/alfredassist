import { describe, it, expect } from "vitest";
import { payoffPace, daysToDeadline, parseDeadline } from "@/lib/goalsAnalytics";
import type { Goal } from "@/lib/goals";

const NOW = new Date(2026, 7, 25, 12, 0, 0); // Aug 25 2026

function mkDebt(p: Partial<Goal> = {}): Goal {
  return {
    id: "g",
    title: "Pay off credit card",
    category: "Money",
    timeframe: "quarterly",
    quarter: null,
    financialType: "debt",
    unit: "$",
    target: 5000, // original balance
    current: 1200, // paid so far → $3,800 still owed
    done: false,
    createdAt: new Date(2026, 0, 1).getTime(),
    ...p,
  } as Goal;
}

describe("parseDeadline", () => {
  it("accepts both the plain date and the date picker's ISO timestamp", () => {
    const plain = parseDeadline("2026-12-31")!;
    const iso = parseDeadline(new Date(2026, 11, 31).toISOString())!;
    expect(plain.getFullYear()).toBe(2026);
    expect(plain.getMonth()).toBe(11);
    expect(plain.getDate()).toBe(31);
    expect(iso.getDate()).toBe(31);
    expect(iso.getMonth()).toBe(11);
  });

  it("reads a plain date as local, not UTC", () => {
    // new Date("2026-12-31") is UTC midnight — the 30th for anyone west of GMT.
    expect(parseDeadline("2026-12-31")!.getDate()).toBe(31);
  });

  it("returns null for junk rather than an Invalid Date", () => {
    expect(parseDeadline("not-a-date")).toBeNull();
    expect(parseDeadline(undefined)).toBeNull();
  });
});

describe("daysToDeadline", () => {
  it("never returns NaN for a picker-saved deadline", () => {
    const d = daysToDeadline(new Date(2026, 11, 31).toISOString(), NOW);
    expect(d).not.toBeNull();
    expect(Number.isFinite(d!)).toBe(true);
    expect(d).toBe(129); // Aug 25 through Dec 31, inclusive
  });
});

describe("payoffPace", () => {
  it("turns a balance into per-day, per-week and per-month payments", () => {
    const pace = payoffPace(mkDebt({ deadline: "2026-12-31" }), NOW)!;
    expect(pace.remaining).toBe(3800);
    expect(pace.daysLeft).toBe(129);
    expect(pace.perDay).toBeCloseTo(3800 / 129, 5);
    expect(pace.perWeek).toBeCloseTo(pace.perDay * 7, 5);
    // The three cadences must describe the same plan.
    expect(pace.perMonth / pace.perDay).toBeCloseTo(365.25 / 12, 5);
  });

  it("shrinks the required payment after a payment is made", () => {
    const before = payoffPace(mkDebt({ deadline: "2026-12-31" }), NOW)!;
    const after = payoffPace(mkDebt({ deadline: "2026-12-31", current: 1700 }), NOW)!;
    expect(after.remaining).toBe(3300);
    expect(after.perWeek).toBeLessThan(before.perWeek);
  });

  it("returns null when there is nothing left to pay", () => {
    expect(payoffPace(mkDebt({ deadline: "2026-12-31", current: 5000 }), NOW)).toBeNull();
  });

  it("returns null without a deadline instead of guessing one", () => {
    expect(payoffPace(mkDebt({ deadline: undefined }), NOW)).toBeNull();
  });

  it("returns null once the deadline has passed", () => {
    expect(payoffPace(mkDebt({ deadline: "2026-01-01" }), NOW)).toBeNull();
  });
});
