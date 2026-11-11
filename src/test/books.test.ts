import { describe, it, expect } from "vitest";
import { bookPace, goalDerivedDueDates, sortBooks, finishedCount, type Book } from "@/lib/books";
import type { Goal } from "@/lib/goals";

const NOW = new Date(2026, 7, 25, 12, 0, 0); // Aug 25 2026

const goal: Goal = {
  id: "g14",
  title: "Read 12 books",
  category: "Skills",
  timeframe: "annual",
  quarter: null,
  target: 12,
  current: 0,
  unit: "books",
  deadline: "2026-12-31",
  done: false,
  createdAt: new Date(2026, 0, 1).getTime(),
} as Goal;

function mkBook(p: Partial<Book> = {}): Book {
  return {
    id: "b1",
    goalId: "g14",
    title: "Dune",
    totalPages: 400,
    pagesRead: 0,
    status: "reading",
    createdAt: 1,
    ...p,
  };
}

describe("sortBooks", () => {
  it("puts what you're reading first, then the shelf, then finished", () => {
    const books = [
      mkBook({ id: "c", status: "done", createdAt: 1 }),
      mkBook({ id: "b", status: "want", createdAt: 2 }),
      mkBook({ id: "a", status: "reading", createdAt: 3 }),
    ];
    expect(sortBooks(books).map((b) => b.id)).toEqual(["a", "b", "c"]);
  });
});

describe("bookPace", () => {
  it("uses the book's own target date when it has one", () => {
    const b = mkBook({ targetDate: "2026-09-04", totalPages: 100, pagesRead: 0 });
    const pace = bookPace(b, goal, [b], NOW)!;
    expect(pace.source).toBe("book");
    expect(pace.finishBy).toBe("2026-09-04");
    expect(pace.daysLeft).toBe(11); // Aug 25 through Sep 4 inclusive
    expect(pace.pagesPerDay).toBeCloseTo(100 / 11, 5);
  });

  it("falls back to a slice of the goal deadline", () => {
    const a = mkBook({ id: "a", status: "reading", createdAt: 1 });
    const b = mkBook({ id: "b", status: "want", createdAt: 2 });
    const pace = bookPace(a, goal, [a, b], NOW)!;
    expect(pace.source).toBe("goal");
    // Two unread books share ~128 days, so the first is due around mid-October,
    // well before the goal's own deadline.
    expect(pace.finishBy < "2026-12-31").toBe(true);
    expect(pace.finishBy > "2026-09-01").toBe(true);
  });

  it("counts only remaining pages, so logging progress eases the pace", () => {
    const fresh = mkBook({ targetDate: "2026-09-04", totalPages: 100, pagesRead: 0 });
    const partway = mkBook({ targetDate: "2026-09-04", totalPages: 100, pagesRead: 60 });
    const a = bookPace(fresh, goal, [fresh], NOW)!;
    const c = bookPace(partway, goal, [partway], NOW)!;
    expect(c.pagesLeft).toBe(40);
    expect(c.pagesPerDay).toBeLessThan(a.pagesPerDay);
  });

  it("has no pace for a finished book or one with no page count", () => {
    expect(bookPace(mkBook({ status: "done" }), goal, [], NOW)).toBeNull();
    expect(bookPace(mkBook({ totalPages: undefined }), goal, [], NOW)).toBeNull();
  });

  it("never divides by zero when the deadline is today or past", () => {
    const past = { ...goal, deadline: "2026-01-01" };
    const b = mkBook();
    expect(bookPace(b, past, [b], NOW)).toBeNull();
  });
});

describe("goalDerivedDueDates", () => {
  it("gives each unread book its own slot, in reading order", () => {
    const a = mkBook({ id: "a", status: "reading", createdAt: 1 });
    const b = mkBook({ id: "b", status: "want", createdAt: 2 });
    const done = mkBook({ id: "c", status: "done", createdAt: 3 });
    const due = goalDerivedDueDates([a, b, done], goal, NOW);
    expect(Object.keys(due).sort()).toEqual(["a", "b"]); // finished books get no slot
    expect(due.a < due.b).toBe(true);
  });

  it("returns nothing without a deadline to divide up", () => {
    const b = mkBook();
    expect(goalDerivedDueDates([b], { ...goal, deadline: undefined }, NOW)).toEqual({});
  });
});

describe("finishedCount", () => {
  it("counts what the goal's progress number should read", () => {
    expect(
      finishedCount([
        mkBook({ id: "a", status: "done" }),
        mkBook({ id: "b", status: "reading" }),
        mkBook({ id: "c", status: "done" }),
      ]),
    ).toBe(2);
  });
});
