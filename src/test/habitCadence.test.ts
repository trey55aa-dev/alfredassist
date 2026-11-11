import { describe, it, expect } from "vitest";
import { normalizeCadence, normalizeHabits, buildRecovery, type Habit } from "@/lib/habits";

describe("normalizeCadence", () => {
  it("keeps every real cadence as-is", () => {
    for (const c of ["daily", "weekly", "monthly", "quarterly", "annual"] as const) {
      expect(normalizeCadence(c)).toBe(c);
    }
  });

  it("falls back to daily for anything else", () => {
    expect(normalizeCadence(undefined)).toBe("daily");
    expect(normalizeCadence(null)).toBe("daily");
    expect(normalizeCadence("")).toBe("daily");
    expect(normalizeCadence("hourly")).toBe("daily");
    expect(normalizeCadence(7)).toBe("daily");
  });
});

describe("normalizeHabits", () => {
  it("repairs a row saved without a cadence", () => {
    const out = normalizeHabits([{ id: "x", title: "Test", createdAt: 1, archived: false }]);
    expect(out).toHaveLength(1);
    expect(out[0].cadence).toBe("daily");
  });

  it("leaves valid rows untouched", () => {
    const row = { id: "x", title: "Test", cadence: "weekly", createdAt: 1 };
    expect(normalizeHabits([row])[0]).toBe(row);
  });

  it("drops rows that aren't habits at all, rather than throwing", () => {
    expect(normalizeHabits([null, 5, "nope", { title: "no id" }])).toEqual([]);
    expect(normalizeHabits("not an array")).toEqual([]);
    expect(normalizeHabits(undefined)).toEqual([]);
  });
});

describe("buildRecovery with a malformed habit", () => {
  it("does not throw when cadence is missing", () => {
    // This exact shape took out the Dashboard, Checklist, Agenda and Review.
    const broken = { id: "x", title: "Test", createdAt: 1, archived: false } as unknown as Habit;
    expect(() => buildRecovery(broken, [], new Date(2026, 7, 25))).not.toThrow();
    const rec = buildRecovery(broken, [], new Date(2026, 7, 25));
    expect(rec.steps.length).toBeGreaterThan(0);
    expect(typeof rec.flavor).toBe("string");
  });
});
