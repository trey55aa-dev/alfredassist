import { describe, it, expect, beforeEach } from "vitest";
import { streakAtRisk, goalCheckInDue } from "@/lib/reminders";
import { todayKey } from "@/lib/alfred";

const TODAY = todayKey();

function at(hour: number): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
}

beforeEach(() => {
  localStorage.clear();
});

describe("streakAtRisk", () => {
  it("returns false before 7pm even with undone habits", () => {
    const habit = { id: "h1", cadence: "daily", archived: false, name: "Run" };
    localStorage.setItem("alfred.habits", JSON.stringify([habit]));
    localStorage.setItem("alfred.habitLogs", JSON.stringify([]));
    expect(streakAtRisk(at(10)).due).toBe(false);
  });

  it("fires at 7pm when daily habits are incomplete", () => {
    const habit = { id: "h1", cadence: "daily", archived: false, name: "Run" };
    localStorage.setItem("alfred.habits", JSON.stringify([habit]));
    localStorage.setItem("alfred.habitLogs", JSON.stringify([]));
    const result = streakAtRisk(at(20));
    expect(result.due).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("does not fire when all daily habits are already logged today", () => {
    const habit = { id: "h1", cadence: "daily", archived: false, name: "Run" };
    const log = { habitId: "h1", date: TODAY };
    localStorage.setItem("alfred.habits", JSON.stringify([habit]));
    localStorage.setItem("alfred.habitLogs", JSON.stringify([log]));
    expect(streakAtRisk(at(20)).due).toBe(false);
  });

  it("ignores archived habits", () => {
    const habit = { id: "h1", cadence: "daily", archived: true, name: "Old" };
    localStorage.setItem("alfred.habits", JSON.stringify([habit]));
    localStorage.setItem("alfred.habitLogs", JSON.stringify([]));
    expect(streakAtRisk(at(20)).due).toBe(false);
    expect(streakAtRisk(at(20)).remaining).toBe(0);
  });

  it("counts remaining correctly when some are done", () => {
    const h1 = { id: "h1", cadence: "daily", archived: false, name: "Run" };
    const h2 = { id: "h2", cadence: "daily", archived: false, name: "Read" };
    const log = { habitId: "h1", date: TODAY };
    localStorage.setItem("alfred.habits", JSON.stringify([h1, h2]));
    localStorage.setItem("alfred.habitLogs", JSON.stringify([log]));
    const result = streakAtRisk(at(20));
    expect(result.due).toBe(true);
    expect(result.remaining).toBe(1);
  });
});

describe("goalCheckInDue", () => {
  it("returns false before noon", () => {
    const goal = { id: "g1", done: false, target: 10 };
    localStorage.setItem("alfred.goals2026", JSON.stringify([goal]));
    expect(goalCheckInDue(at(11)).due).toBe(false);
  });

  it("fires at noon when measurable goals are not logged today", () => {
    const goal = { id: "g1", done: false, target: 10, progressLog: {} };
    localStorage.setItem("alfred.goals2026", JSON.stringify([goal]));
    const result = goalCheckInDue(at(14));
    expect(result.due).toBe(true);
    expect(result.count).toBe(1);
  });

  it("does not fire when goal is already logged today", () => {
    const goal = { id: "g1", done: false, target: 10, progressLog: { [TODAY]: 5 } };
    localStorage.setItem("alfred.goals2026", JSON.stringify([goal]));
    expect(goalCheckInDue(at(14)).due).toBe(false);
  });

  it("does not fire when goal is marked done", () => {
    const goal = { id: "g1", done: true, target: 10 };
    localStorage.setItem("alfred.goals2026", JSON.stringify([goal]));
    expect(goalCheckInDue(at(14)).due).toBe(false);
  });

  it("does not fire for goals with no numeric target", () => {
    const goal = { id: "g1", done: false, target: null };
    localStorage.setItem("alfred.goals2026", JSON.stringify([goal]));
    expect(goalCheckInDue(at(14)).due).toBe(false);
  });

  it("does not fire after 10pm", () => {
    const goal = { id: "g1", done: false, target: 10 };
    localStorage.setItem("alfred.goals2026", JSON.stringify([goal]));
    expect(goalCheckInDue(at(22)).due).toBe(false);
  });
});
