import { describe, expect, it } from "vitest";
import {
  DECAY_FLOOR_FACTOR,
  addDaysYmd,
  daysBetweenYmd,
  decayedXp,
  distributeDecay,
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

describe("distributeDecay (per-day ledger — powers make-up refunds)", () => {
  it("per-day charges sum to the total decay", () => {
    const charges = distributeDecay(1000, 6);
    expect(charges).toHaveLength(6);
    const total = charges.reduce((a, b) => a + b, 0);
    expect(1000 - total).toBe(decayedXp(1000, 6)); // 886
  });

  it("first missed day of 1000 XP costs 20 (2%)", () => {
    expect(distributeDecay(1000, 1)).toEqual([20]);
  });

  it("stops charging once the 25% floor is reached", () => {
    const charges = distributeDecay(1000, 365);
    const total = charges.reduce((a, b) => a + b, 0);
    expect(1000 - total).toBe(250);
    expect(charges.at(-1)).toBe(0); // late days cost nothing at the floor
  });

  it("no charges for zero xp or zero days", () => {
    expect(distributeDecay(0, 5)).toEqual([]);
    expect(distributeDecay(1000, 0)).toEqual([]);
  });
});

describe("addDaysYmd", () => {
  it("walks forward across month boundaries", () => {
    expect(addDaysYmd("2026-06-28", 7)).toBe("2026-07-05");
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
