import { describe, it, expect } from "vitest";
import { buildRecapItems, formatRecapText } from "@/lib/dailyRecap";
import type { AgendaEvent } from "@/lib/agenda";
import type { Habit, HabitLog } from "@/lib/habits";

const DAY = new Date(2026, 7, 7, 20, 0, 0); // Aug 7 2026, evening
const DATE_STR = "2026-08-07";

function event(over: Partial<AgendaEvent> = {}): AgendaEvent {
  return {
    id: "rec:tpl1:2026-08-07",
    title: "SIE Study",
    start: "2026-08-07T07:10:00",
    end: "2026-08-07T07:50:00",
    source: "recurring",
    completed: false,
    ...over,
  };
}

const dailyHabit: Habit = { id: "h1", title: "Drink water", cadence: "daily", createdAt: 0 };
const weeklyHabit: Habit = { id: "h2", title: "Church", cadence: "weekly", createdAt: 0 };

describe("buildRecapItems", () => {
  it("marks a completed event done with its actual completion time", () => {
    const items = buildRecapItems(
      [event({ completed: true, completedAt: new Date(2026, 7, 7, 7, 42).getTime() })],
      [],
      [],
      {},
      DAY,
    );
    expect(items[0].done).toBe(true);
    expect(items[0].actualMs).toBe(new Date(2026, 7, 7, 7, 42).getTime());
  });

  it("always includes a daily habit, but only includes a weekly habit if logged today", () => {
    const noLogs = buildRecapItems([], [dailyHabit, weeklyHabit], [], {}, DAY);
    expect(noLogs.map((i) => i.title)).toEqual(["Drink water"]);

    const withChurchLogged: HabitLog[] = [{ habitId: "h2", date: DATE_STR }];
    const withLog = buildRecapItems([], [dailyHabit, weeklyHabit], withChurchLogged, {}, DAY);
    expect(withLog.map((i) => i.title).sort()).toEqual(["Church", "Drink water"]);
  });

  it("sorts by actual time when done, scheduled time when pending", () => {
    const items = buildRecapItems(
      [
        event({ id: "e1", title: "Late block", start: "2026-08-07T09:00:00" }),
        event({
          id: "e2",
          title: "Early but logged late",
          start: "2026-08-07T06:00:00",
          completed: true,
          completedAt: new Date(2026, 7, 7, 10, 0).getTime(),
        }),
      ],
      [],
      [],
      {},
      DAY,
    );
    expect(items.map((i) => i.title)).toEqual(["Late block", "Early but logged late"]);
  });

  it("excludes all-day events", () => {
    const items = buildRecapItems([event({ allDay: true })], [], [], {}, DAY);
    expect(items).toHaveLength(0);
  });
});

describe("formatRecapText", () => {
  const items = [
    { id: "1", title: "SIE Study", kind: "event" as const, done: true, actualMs: new Date(2026, 7, 7, 7, 14).getTime() },
    { id: "2", title: "Walk", kind: "event" as const, done: false, scheduledMs: new Date(2026, 7, 7, 12, 30).getTime() },
  ];

  it("checklist style shows both done and pending with the right marks", () => {
    const text = formatRecapText(items, "checklist", "Friday, Aug 7");
    expect(text).toContain("✓");
    expect(text).toContain("☐");
    expect(text).toContain("SIE Study");
    expect(text).toContain("Walk");
  });

  it("accomplished style only lists what's done", () => {
    const text = formatRecapText(items, "accomplished", "Friday, Aug 7");
    expect(text).toContain("SIE Study");
    expect(text).not.toContain("Walk");
  });

  it("withNote style appends the feedback text", () => {
    const text = formatRecapText(items, "withNote", "Friday, Aug 7", "Felt great today");
    expect(text).toContain("Felt great today");
  });
});
