import { describe, expect, it, beforeEach } from "vitest";
import { getDailyHighlight, setDailyHighlight, recentHighlights } from "@/lib/dailyHighlight";

describe("dailyHighlight", () => {
  beforeEach(() => localStorage.clear());

  it("empty by default", () => {
    expect(getDailyHighlight("2026-07-10")).toBe("");
  });

  it("set then get round-trips", () => {
    setDailyHighlight("2026-07-10", "Ship the release notes");
    expect(getDailyHighlight("2026-07-10")).toBe("Ship the release notes");
  });

  it("setting empty text clears the day rather than storing blank", () => {
    setDailyHighlight("2026-07-10", "Something");
    setDailyHighlight("2026-07-10", "   ");
    expect(getDailyHighlight("2026-07-10")).toBe("");
  });

  it("recentHighlights returns newest first, skipping unset days", () => {
    setDailyHighlight("2026-07-08", "Two days ago");
    setDailyHighlight("2026-07-10", "Today");
    const result = recentHighlights(5, new Date("2026-07-10T12:00:00"));
    expect(result).toEqual([
      { date: "2026-07-10", text: "Today" },
      { date: "2026-07-08", text: "Two days ago" },
    ]);
  });
});
