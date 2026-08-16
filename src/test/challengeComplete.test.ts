import { describe, it, expect, beforeEach } from "vitest";
import { awardXp, getGamification, XP_VALUES } from "@/lib/gamification";

beforeEach(() => {
  localStorage.clear();
});

describe("challenge completion award", () => {
  it("grants the huge XP award and the badge", () => {
    const result = awardXp(XP_VALUES.CHALLENGE_COMPLETE, "challenge", { challengeComplete: true });
    expect(result.xp).toBe(XP_VALUES.CHALLENGE_COMPLETE);
    expect(result.newBadges.map((b) => b.id)).toContain("challenge_complete");
    expect(getGamification().xp).toBe(XP_VALUES.CHALLENGE_COMPLETE);
  });

  it("never re-awards the badge on a second call (idempotent)", () => {
    awardXp(XP_VALUES.CHALLENGE_COMPLETE, "challenge", { challengeComplete: true });
    const second = awardXp(XP_VALUES.CHALLENGE_COMPLETE, "challenge", { challengeComplete: true });
    // Crossing 1500 XP incidentally unlocks a level badge — what matters is
    // that "challenge_complete" itself never fires twice.
    expect(second.newBadges.map((b) => b.id)).not.toContain("challenge_complete");
    // Base XP still applies each call — the component-level effect is what
    // prevents this from firing more than once in practice.
    expect(getGamification().xp).toBe(XP_VALUES.CHALLENGE_COMPLETE * 2);
  });
});
