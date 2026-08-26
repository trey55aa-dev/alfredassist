import { describe, it, expect, beforeEach } from "vitest";
import {
  HABIT_STEPS_KEY,
  loadStepTicks,
  newStep,
  purgeStepTicks,
  setAllSteps,
  stepProgress,
  stepsFromText,
  stepsToText,
  stepLabel,
  ticksFor,
  toggleStep,
} from "@/lib/habitSteps";
import type { Habit } from "@/lib/habits";

const DATE = "2026-08-26";

const brush = { id: "s1", title: "brush teeth" };
const water = { id: "s2", title: "water" };
const floss = { id: "s3", title: "floss" };

function routine(steps = [brush, water, floss]): Habit {
  return {
    id: "h1",
    title: "Morning routine",
    cadence: "daily",
    createdAt: 0,
    steps,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("stepProgress", () => {
  it("counts what's ticked out of the routine", () => {
    toggleStep(routine(), "s1", false, DATE);
    expect(stepProgress(routine(), loadStepTicks(), DATE)).toEqual({
      done: 1,
      total: 3,
      allDone: false,
    });
  });

  it("is not 'allDone' for a habit with no steps at all", () => {
    const plain: Habit = { id: "h2", title: "Walk", cadence: "daily", createdAt: 0 };
    expect(stepProgress(plain, {}, DATE).allDone).toBe(false);
    expect(stepLabel(plain, {}, DATE)).toBeNull();
  });

  it("ignores ticks for steps the habit no longer has", () => {
    // Tick all three, then delete one from the routine.
    for (const id of ["s1", "s2", "s3"]) toggleStep(routine(), id, false, DATE);
    const trimmed = routine([brush, water]);
    // Never reports 3/2 — a count above its own list is what stops people
    // trusting the number.
    expect(stepProgress(trimmed, loadStepTicks(), DATE)).toEqual({
      done: 2,
      total: 2,
      allDone: true,
    });
  });
});

describe("toggleStep ↔ the habit's own tick", () => {
  it("completes the habit when the last step goes in", () => {
    expect(toggleStep(routine(), "s1", false, DATE).habitShouldComplete).toBe(false);
    expect(toggleStep(routine(), "s2", false, DATE).habitShouldComplete).toBe(false);
    const last = toggleStep(routine(), "s3", false, DATE);
    expect(last.habitShouldComplete).toBe(true);
    expect(last.habitShouldReopen).toBe(false);
  });

  it("does not re-complete a habit that is already ticked", () => {
    for (const id of ["s1", "s2"]) toggleStep(routine(), id, false, DATE);
    expect(toggleStep(routine(), "s3", true, DATE).habitShouldComplete).toBe(false);
  });

  it("reopens the habit when a step comes back off a finished routine", () => {
    setAllSteps(routine(), true, DATE);
    const result = toggleStep(routine(), "s2", true, DATE);
    expect(result.habitShouldReopen).toBe(true);
    expect(result.habitShouldComplete).toBe(false);
    expect(ticksFor(result.ticks, "h1", DATE)).not.toContain("s2");
  });

  it("untickng a step on an unfinished routine changes nothing about the habit", () => {
    toggleStep(routine(), "s1", false, DATE);
    const result = toggleStep(routine(), "s1", false, DATE);
    expect(result.habitShouldComplete).toBe(false);
    expect(result.habitShouldReopen).toBe(false);
  });
});

describe("setAllSteps", () => {
  it("fills every step in when the habit itself is ticked", () => {
    setAllSteps(routine(), true, DATE);
    expect(stepProgress(routine(), loadStepTicks(), DATE).allDone).toBe(true);
  });

  it("clears the list when the habit is unticked — nothing left stranded", () => {
    setAllSteps(routine(), true, DATE);
    setAllSteps(routine(), false, DATE);
    expect(ticksFor(loadStepTicks(), "h1", DATE)).toEqual([]);
  });

  it("keeps other days untouched", () => {
    setAllSteps(routine(), true, "2026-08-25");
    setAllSteps(routine(), false, DATE);
    expect(ticksFor(loadStepTicks(), "h1", "2026-08-25")).toHaveLength(3);
  });
});

describe("editing the step list", () => {
  it("keeps ids for unchanged titles so today's ticks survive a typo fix", () => {
    const before = [brush, water];
    const after = stepsFromText("brush teeth\nwaterr", before);
    expect(after[0].id).toBe("s1"); // untouched line keeps its tick
    expect(after[1].id).not.toBe("s2"); // the edited line is genuinely new
  });

  it("gives two steps sharing a title one id each", () => {
    const dup = [
      { id: "a", title: "water" },
      { id: "b", title: "water" },
    ];
    const after = stepsFromText("water\nwater", dup);
    expect(new Set(after.map((s) => s.id))).toEqual(new Set(["a", "b"]));
  });

  it("drops blank lines and round-trips through text", () => {
    const steps = stepsFromText("brush teeth\n\n  water  \n");
    expect(steps.map((s) => s.title)).toEqual(["brush teeth", "water"]);
    expect(stepsToText(steps)).toBe("brush teeth\nwater");
  });
});

describe("storage robustness", () => {
  it("survives a corrupt store instead of throwing", () => {
    localStorage.setItem(HABIT_STEPS_KEY, "not json");
    expect(loadStepTicks()).toEqual({});
    localStorage.setItem(HABIT_STEPS_KEY, JSON.stringify({ "h1|x": "nope" }));
    expect(loadStepTicks()).toEqual({});
  });

  it("purges a deleted habit's ticks without touching others", () => {
    setAllSteps(routine(), true, DATE);
    setAllSteps({ ...routine(), id: "h2" }, true, DATE);
    purgeStepTicks("h1");
    expect(ticksFor(loadStepTicks(), "h1", DATE)).toEqual([]);
    expect(ticksFor(loadStepTicks(), "h2", DATE)).toHaveLength(3);
  });

  it("labels a routine's progress, and nothing for a plain habit", () => {
    toggleStep(routine(), "s1", false, DATE);
    expect(stepLabel(routine(), loadStepTicks(), DATE)).toBe("1/3");
  });

  it("newStep trims the title", () => {
    expect(newStep("  floss  ").title).toBe("floss");
  });
});
