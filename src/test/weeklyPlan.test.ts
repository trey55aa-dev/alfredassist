import { describe, it, expect } from "vitest";
import {
  cellKey,
  planDayToDow,
  dowToPlanDay,
  PLAN_DAYS,
} from "@/lib/weeklyPlan";

describe("cellKey", () => {
  it("formats areaId|dayIdx", () => {
    expect(cellKey("work", 0)).toBe("work|0");
    expect(cellKey("body", 6)).toBe("body|6");
  });

  it("handles special chars in areaId", () => {
    expect(cellKey("my-area", 3)).toBe("my-area|3");
  });
});

describe("planDayToDow", () => {
  it("Mon (0) → JS dow 1", () => expect(planDayToDow(0)).toBe(1));
  it("Tue (1) → JS dow 2", () => expect(planDayToDow(1)).toBe(2));
  it("Fri (4) → JS dow 5", () => expect(planDayToDow(4)).toBe(5));
  it("Sat (5) → JS dow 6", () => expect(planDayToDow(5)).toBe(6));
  it("Sun (6) → JS dow 0", () => expect(planDayToDow(6)).toBe(0));
});

describe("dowToPlanDay", () => {
  it("JS dow 0 (Sun) → planIdx 6", () => expect(dowToPlanDay(0)).toBe(6));
  it("JS dow 1 (Mon) → planIdx 0", () => expect(dowToPlanDay(1)).toBe(0));
  it("JS dow 6 (Sat) → planIdx 5", () => expect(dowToPlanDay(6)).toBe(5));
});

describe("planDayToDow / dowToPlanDay roundtrip", () => {
  it("roundtrips for all 7 plan days", () => {
    for (let i = 0; i < 7; i++) {
      expect(dowToPlanDay(planDayToDow(i))).toBe(i);
    }
  });

  it("PLAN_DAYS has 7 unique dow mappings", () => {
    expect(PLAN_DAYS).toHaveLength(7);
    const dows = new Set(PLAN_DAYS.map((_, i) => planDayToDow(i)));
    expect(dows.size).toBe(7);
  });
});
