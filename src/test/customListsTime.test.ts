import { describe, expect, it } from "vitest";
import { formatMinutes, listMinutesSummary, type CustomListItem } from "@/lib/customLists";

describe("formatMinutes", () => {
  it("under an hour shows minutes only", () => {
    expect(formatMinutes(45)).toBe("45m");
  });
  it("exact hour shows no minutes", () => {
    expect(formatMinutes(120)).toBe("2h");
  });
  it("hour plus minutes shows both", () => {
    expect(formatMinutes(90)).toBe("1h30m");
  });
});

describe("listMinutesSummary", () => {
  const item = (over: Partial<CustomListItem>): CustomListItem => ({
    id: crypto.randomUUID(),
    text: "x",
    done: false,
    ...over,
  });

  it("no estimates at all → zero budget, not zero-of-zero", () => {
    const s = listMinutesSummary({ items: [item({}), item({ done: true })] });
    expect(s.totalMinutes).toBe(0);
    expect(s.doneMinutes).toBe(0);
  });

  it("items without an estimate don't count toward either side", () => {
    const s = listMinutesSummary({
      items: [item({ estimatedMinutes: 30, done: true }), item({})],
    });
    expect(s.totalMinutes).toBe(30);
    expect(s.doneMinutes).toBe(30);
  });

  it("sums total and done separately", () => {
    const s = listMinutesSummary({
      items: [
        item({ estimatedMinutes: 30, done: true }),
        item({ estimatedMinutes: 60, done: false }),
        item({ estimatedMinutes: 15, done: true }),
      ],
    });
    expect(s.totalMinutes).toBe(105);
    expect(s.doneMinutes).toBe(45);
  });
});
