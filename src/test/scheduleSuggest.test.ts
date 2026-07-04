import { describe, it, expect } from "vitest";
import { suggestSchedule } from "@/lib/scheduleSuggest";
import type { Goal } from "@/lib/goals";
import type { AgendaEvent } from "@/lib/agenda";

let n = 0;
function mkGoal(p: Partial<Goal> = {}): Goal {
  return {
    id: p.id ?? `g${n++}`,
    title: p.title ?? "Goal",
    category: p.category ?? "Skills",
    timeframe: "annual",
    quarter: null,
    done: false,
    createdAt: Date.now(),
    ...p,
  } as Goal;
}

function mkEvent(date: Date, sh: number, eh: number): AgendaEvent {
  const s = new Date(date); s.setHours(sh, 0, 0, 0);
  const e = new Date(date); e.setHours(eh, 0, 0, 0);
  return { id: `e${sh}-${eh}`, title: "Busy", start: s.toISOString(), end: e.toISOString(), source: "manual" };
}

// Fixed window: midnight "now" so the 8am day-start is used verbatim (deterministic).
const DATE = new Date(2026, 5, 15, 0, 0, 0, 0);
const OPTS = { date: DATE, now: DATE };
const min = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 60000;

describe("suggestSchedule", () => {
  it("returns nothing when there are no active goals", () => {
    expect(suggestSchedule([], [], OPTS)).toEqual([]);
    expect(suggestSchedule([mkGoal({ done: true })], [], OPTS)).toEqual([]);
  });

  it("fills an empty day from 8am with 45-min blocks and 15-min buffers", () => {
    const blocks = suggestSchedule([mkGoal(), mkGoal()], [], OPTS);
    expect(blocks).toHaveLength(2);
    expect(new Date(blocks[0].start).getHours()).toBe(8);
    expect(new Date(blocks[0].start).getMinutes()).toBe(0);
    expect(min(blocks[0].start, blocks[0].end)).toBe(45); // block length
    // second block starts after 45 + 15 buffer = 9:00
    expect(new Date(blocks[1].start).getHours()).toBe(9);
    expect(new Date(blocks[1].start).getMinutes()).toBe(0);
    // no overlap
    expect(new Date(blocks[1].start).getTime()).toBeGreaterThanOrEqual(new Date(blocks[0].end).getTime());
  });

  it("places blocks only in the free gaps around existing events", () => {
    // Busy 8–11; first free block should start at 11:00.
    const blocks = suggestSchedule([mkGoal()], [mkEvent(DATE, 8, 11)], OPTS);
    expect(blocks).toHaveLength(1);
    expect(new Date(blocks[0].start).getHours()).toBe(11);
  });

  it("never overlaps a busy block", () => {
    const busy = mkEvent(DATE, 9, 10);
    const blocks = suggestSchedule([mkGoal(), mkGoal(), mkGoal()], [busy], OPTS);
    const bs = new Date(busy.start).getTime();
    const be = new Date(busy.end).getTime();
    for (const b of blocks) {
      const s = new Date(b.start).getTime();
      const e = new Date(b.end).getTime();
      expect(e <= bs || s >= be).toBe(true); // fully before or after the busy slot
    }
  });

  it("orders work by nearest deadline first", () => {
    const near = mkGoal({ id: "near", deadline: new Date(Date.now() + 7 * 864e5).toISOString() });
    const far = mkGoal({ id: "far", deadline: new Date(Date.now() + 120 * 864e5).toISOString() });
    const blocks = suggestSchedule([far, near], [], OPTS);
    expect(blocks[0].goalId).toBe("near");
    expect(blocks[1].goalId).toBe("far");
  });

  it("caps output at maxBlocks", () => {
    const goals = Array.from({ length: 10 }, () => mkGoal());
    const blocks = suggestSchedule(goals, [], { ...OPTS, maxBlocks: 3 });
    expect(blocks).toHaveLength(3);
  });

  it("returns nothing when the day is fully booked", () => {
    const blocks = suggestSchedule([mkGoal()], [mkEvent(DATE, 8, 21)], OPTS);
    expect(blocks).toEqual([]);
  });
});
