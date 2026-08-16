import { describe, it, expect, beforeEach } from "vitest";
import {
  getRewardPrefs,
  setRewardPrefs,
  toggleRewardPref,
  suggestRewards,
} from "@/lib/rewards";

beforeEach(() => {
  localStorage.clear();
});

describe("reward prefs", () => {
  it("starts empty", () => {
    expect(getRewardPrefs()).toEqual([]);
  });

  it("toggling adds then removes a tag", () => {
    expect(toggleRewardPref("Outdoors")).toEqual(["Outdoors"]);
    expect(getRewardPrefs()).toEqual(["Outdoors"]);
    expect(toggleRewardPref("Outdoors")).toEqual([]);
    expect(getRewardPrefs()).toEqual([]);
  });

  it("ignores garbage in storage", () => {
    localStorage.setItem("alfred.rewardPrefs", JSON.stringify(["Outdoors", "Not A Tag"]));
    expect(getRewardPrefs()).toEqual(["Outdoors"]);
  });

  it("ignores non-array storage", () => {
    localStorage.setItem("alfred.rewardPrefs", JSON.stringify({ oops: true }));
    expect(getRewardPrefs()).toEqual([]);
  });
});

describe("suggestRewards", () => {
  it("returns the requested count", () => {
    expect(suggestRewards([], 3)).toHaveLength(3);
  });

  it("only pulls from matching tags when prefs are set", () => {
    const outdoorsIdeas = [
      "Take a walk somewhere new",
      "A hike or trail you haven't done",
      "Sit outside with no phone for 20 minutes",
    ];
    setRewardPrefs(["Outdoors"]);
    const ideas = suggestRewards(undefined, 3, () => 0);
    expect(ideas).toHaveLength(3);
    for (const idea of ideas) {
      expect(outdoorsIdeas).toContain(idea);
    }
  });

  it("falls back to the full pool with no prefs", () => {
    const ideas = suggestRewards([], 5);
    expect(ideas.length).toBe(5);
  });

  it("is deterministic given a fixed rand()", () => {
    const a = suggestRewards(["Games"], 2, () => 0.5);
    const b = suggestRewards(["Games"], 2, () => 0.5);
    expect(a).toEqual(b);
  });
});
