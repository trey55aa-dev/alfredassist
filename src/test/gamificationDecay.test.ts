import { describe, expect, it } from "vitest";
import {
  DECAY_FLOOR_FACTOR,
  daysBetweenYmd,
  decayedXp,
} from "@/lib/gamification";

describe("decayedXp", () => {
  it("no absence → no change", () => {
    expect(decayedXp(1000, 0)).toBe(1000);
    expect(decayedXp(1000, -3)).toBe(1000);
  });

  it("one missed day beyond grace costs 2%", () => {
    expect(decayedXp(1000, 1)).toBe(980);
  });

  it("compounds over a week away", () => {
    // 0.98^6 ≈ 0.8858
    expect(decayedXp(1000, 6)).toBe(886);
  });

  it("a month away drops meaningfully but never wipes out", () => {
    const after = decayedXp(3200, 29); // Elite-level XP, ~a month gone
    expect(after).toBeLessThan(3200 * 0.6);
    expect(after).toBeGreaterThanOrEqual(3200 * DECAY_FLOOR_FACTOR);
  });

  it("floors at 25% no matter how long the absence", () => {
    expect(decayedXp(1000, 365)).toBe(250);
  });

  it("zero XP stays zero", () => {
    expect(decayedXp(0, 10)).toBe(0);
  });
});

describe("daysBetweenYmd", () => {
  it("same day is 0", () => {
    expect(daysBetweenYmd("2026-07-05", "2026-07-05")).toBe(0);
  });
  it("counts calendar days across month boundaries", () => {
    expect(daysBetweenYmd("2026-06-28", "2026-07-05")).toBe(7);
  });
});
