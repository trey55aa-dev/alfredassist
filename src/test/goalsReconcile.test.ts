import { describe, it, expect } from "vitest";
import { reconcileGoals, goalContentChanged } from "@/hooks/useCloudGoals";
import type { Goal } from "@/lib/goals";
import type { LoadedGoal } from "@/lib/goalsRepo";

function goal(partial: Partial<Goal> & { id: string }): Goal {
  return {
    title: "G",
    category: "Life",
    timeframe: "annual",
    quarter: null,
    done: false,
    createdAt: 0,
    ...partial,
  };
}

function cloud(g: Goal, cloudUpdatedAt: number): LoadedGoal {
  return { goal: g, cloudUpdatedAt };
}

describe("reconcileGoals", () => {
  it("adopts a cloud goal crossed off on another device (the reported bug)", () => {
    // Phone: goal not done, never edited locally (localUpdatedAt absent → 0).
    const local = [goal({ id: "g1", done: false })];
    // Cloud: same goal marked done on the computer, pushed recently.
    const remote = [cloud(goal({ id: "g1", done: true }), 1000)];

    const { finalGoals, toSync } = reconcileGoals(local, remote);

    expect(finalGoals).toHaveLength(1);
    expect(finalGoals[0].done).toBe(true); // phone now reflects the computer
    expect(toSync).toHaveLength(0); // nothing to push back
  });

  it("keeps a local edit that is newer than the cloud and queues it for push", () => {
    const local = [goal({ id: "g1", done: true, localUpdatedAt: 5000 })];
    const remote = [cloud(goal({ id: "g1", done: false }), 1000)];

    const { finalGoals, toSync } = reconcileGoals(local, remote);

    expect(finalGoals[0].done).toBe(true); // local wins
    expect(toSync).toHaveLength(1);
    expect(toSync[0].id).toBe("g1");
  });

  it("does NOT revert the cloud when the local copy is stale (regression guard)", () => {
    // Old behaviour: local always won and pushed done:false back, reverting the cloud.
    const local = [goal({ id: "g1", done: false, localUpdatedAt: 500 })];
    const remote = [cloud(goal({ id: "g1", done: true }), 2000)];

    const { finalGoals, toSync } = reconcileGoals(local, remote);

    expect(finalGoals[0].done).toBe(true);
    expect(toSync).toHaveLength(0); // never pushes the stale local copy
  });

  it("adds cloud-only goals from another device", () => {
    const local = [goal({ id: "g1" })];
    const remote = [
      cloud(goal({ id: "g1" }), 0),
      cloud(goal({ id: "g2", title: "From other device" }), 100),
    ];

    const { finalGoals } = reconcileGoals(local, remote);
    expect(finalGoals.map((g) => g.id).sort()).toEqual(["g1", "g2"]);
  });

  it("keeps and pushes local-only goals not yet in the cloud", () => {
    const local = [goal({ id: "g1" }), goal({ id: "new", localUpdatedAt: 100 })];
    const remote = [cloud(goal({ id: "g1" }), 0)];

    const { finalGoals, toSync } = reconcileGoals(local, remote);
    expect(finalGoals.map((g) => g.id).sort()).toEqual(["g1", "new"]);
    expect(toSync.map((g) => g.id)).toEqual(["new"]);
  });

  it("preserves the local-only financialType when adopting a cloud goal", () => {
    const local = [goal({ id: "g1", category: "Money", financialType: "savings" })];
    const remote = [cloud(goal({ id: "g1", category: "Money", current: 50 }), 1000)];

    const { finalGoals } = reconcileGoals(local, remote);
    expect(finalGoals[0].current).toBe(50); // cloud value adopted
    expect(finalGoals[0].financialType).toBe("savings"); // local-only field kept
  });

  it("does not treat equal goals with a newer local stamp as a conflict", () => {
    const local = [goal({ id: "g1", done: true, localUpdatedAt: 9999 })];
    const remote = [cloud(goal({ id: "g1", done: true }), 1000)];

    const { toSync } = reconcileGoals(local, remote);
    expect(toSync).toHaveLength(0); // identical content → no needless push
  });
});

describe("goalContentChanged", () => {
  it("ignores the local-only localUpdatedAt stamp", () => {
    const a = goal({ id: "g1", done: true, localUpdatedAt: 1 });
    const b = goal({ id: "g1", done: true, localUpdatedAt: 2 });
    expect(goalContentChanged(a, b)).toBe(false);
  });

  it("detects a real content change", () => {
    const a = goal({ id: "g1", done: false, localUpdatedAt: 1 });
    const b = goal({ id: "g1", done: true, localUpdatedAt: 1 });
    expect(goalContentChanged(a, b)).toBe(true);
  });
});
