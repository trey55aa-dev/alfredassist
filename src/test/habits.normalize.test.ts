import { describe, it, expect } from "vitest";
import { buildRecovery, normalizeHabit, type Habit } from "@/lib/habits";

describe("normalizeHabit", () => {
  it("defaults an invalid/missing cadence to daily instead of crashing downstream", () => {
    // Simulates corrupt localStorage, cross-device sync of pre-cadence-era
    // data, or manual tampering — a habit read back with no cadence at all.
    const malformed = { id: "h1", title: "Run" } as Partial<Habit> & { id: string };
    const habit = normalizeHabit(malformed);
    expect(habit.cadence).toBe("daily");
    // Would throw "DEFAULT_STEPS_BY_CADENCE[habit.cadence] is not a function"
    // before this fix, since buildRecovery indexes that table by cadence.
    expect(() => buildRecovery(habit, [], new Date(2026, 5, 15))).not.toThrow();
  });

  it("rejects a cadence value outside the known union", () => {
    const malformed = {
      id: "h2",
      title: "Read",
      cadence: "biweekly",
    } as unknown as Partial<Habit> & { id: string };
    expect(normalizeHabit(malformed).cadence).toBe("daily");
  });

  it("defaults a missing/blank title instead of leaving it undefined", () => {
    const malformed = { id: "h3", cadence: "weekly" } as Partial<Habit> & { id: string };
    expect(normalizeHabit(malformed).title).toBe("Untitled habit");
  });

  it("preserves valid fields unchanged", () => {
    const valid: Habit = { id: "h4", title: "Meditate", cadence: "weekly", createdAt: 12345 };
    expect(normalizeHabit(valid)).toEqual(valid);
  });
});
