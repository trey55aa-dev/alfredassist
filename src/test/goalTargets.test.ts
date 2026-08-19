import { describe, it, expect, beforeEach } from "vitest";
import {
  addTarget,
  goalDeltaFor,
  isAnsweredToday,
  loadTargetLog,
  loadTargets,
  removeTarget,
  setEntry,
  targetStreak,
  targetsForGoal,
  type GoalDailyTarget,
} from "@/lib/goalTargets";
import { todayKey } from "@/lib/alfred";

const TODAY = todayKey();
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayKey(d);
}

function target(patch: Partial<GoalDailyTarget> = {}): GoalDailyTarget {
  return {
    id: "t1", goalId: "g1", title: "Put $20 aside",
    kind: "amount", amount: 20, createdAt: 0, ...patch,
  };
}

beforeEach(() => localStorage.clear());

describe("targetsForGoal", () => {
  it("returns only that goal's live targets", () => {
    const all = [
      target({ id: "t1", goalId: "g1" }),
      target({ id: "t2", goalId: "g2" }),
      target({ id: "t3", goalId: "g1", archived: true }),
    ];
    expect(targetsForGoal(all, "g1").map((t) => t.id)).toEqual(["t1"]);
  });
});

describe("goalDeltaFor — only real progress moves a goal", () => {
  it("an amount target contributes what was logged", () => {
    expect(goalDeltaFor(target(), { done: true, value: 25 })).toBe(25);
  });

  it("an amount target falls back to its configured amount", () => {
    expect(goalDeltaFor(target(), { done: true })).toBe(20);
  });

  it("avoiding something contributes nothing — there is no amount to add", () => {
    expect(goalDeltaFor(target({ kind: "avoid" }), { done: true })).toBe(0);
  });

  it("logging a number is an observation, not progress", () => {
    // Spending $80 must never count as $80 toward paying the card off.
    expect(goalDeltaFor(target({ kind: "log" }), { value: 80 })).toBe(0);
  });
});

describe("isAnsweredToday", () => {
  it("an amount/avoid target counts once ticked", () => {
    setEntry("t1", { done: true }, TODAY);
    expect(isAnsweredToday(target(), loadTargetLog(), TODAY)).toBe(true);
  });

  it("a log target counts once a number is in — including zero", () => {
    setEntry("t1", { value: 0 }, TODAY);
    expect(isAnsweredToday(target({ kind: "log" }), loadTargetLog(), TODAY)).toBe(true);
  });

  it("is false with no entry at all", () => {
    expect(isAnsweredToday(target(), loadTargetLog(), TODAY)).toBe(false);
  });
});

describe("targetStreak", () => {
  it("counts consecutive answered days ending today", () => {
    [0, 1, 2].forEach((n) => setEntry("t1", { done: true }, daysAgo(n)));
    expect(targetStreak(target(), loadTargetLog())).toBe(3);
  });

  it("survives today being untouched, anchoring on yesterday", () => {
    [1, 2].forEach((n) => setEntry("t1", { done: true }, daysAgo(n)));
    expect(targetStreak(target(), loadTargetLog())).toBe(2);
  });

  it("breaks on a genuinely missed day", () => {
    [0, 1, 3].forEach((n) => setEntry("t1", { done: true }, daysAgo(n)));
    expect(targetStreak(target(), loadTargetLog())).toBe(2);
  });
});

describe("add / remove", () => {
  it("removing a target also clears its history, leaving others intact", () => {
    const created = addTarget({ goalId: "g1", title: "Put $20 aside", kind: "amount", amount: 20 });
    const other = addTarget({ goalId: "g1", title: "No takeout", kind: "avoid" });
    const [a, b] = other;

    setEntry(a.id, { done: true }, TODAY);
    setEntry(b.id, { done: true }, TODAY);
    expect(Object.keys(loadTargetLog())).toHaveLength(2);

    removeTarget(a.id);
    expect(loadTargets().map((t) => t.id)).toEqual([b.id]);
    const log = loadTargetLog();
    expect(Object.keys(log)).toHaveLength(1);
    expect(log[`${b.id}|${TODAY}`]).toEqual({ done: true });
    expect(created.length).toBe(1);
  });

  it("clearing an entry removes it rather than storing a falsy answer", () => {
    setEntry("t1", { done: true }, TODAY);
    setEntry("t1", null, TODAY);
    expect(loadTargetLog()[`t1|${TODAY}`]).toBeUndefined();
  });
});
