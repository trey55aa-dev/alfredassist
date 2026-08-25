// A reading list that hangs off a goal like "Read 12 books".
//
// "12 books by December" is exactly the kind of number that doesn't tell you
// what to do today. A list of actual books, each with a page count and a date
// it needs to be finished by, turns it into "38 pages today" — which you can
// either do or not.
//
// Books you haven't started still count: they're what the remaining months get
// divided between, so the shelf tells you whether the plan fits at all.

import { parseDeadline } from "./goalsAnalytics";
import type { Goal } from "./goals";

export type BookStatus = "want" | "reading" | "done";

export interface Book {
  id: string;
  /** The 2026 goal this book counts toward. */
  goalId: string;
  title: string;
  author?: string;
  totalPages?: number;
  pagesRead: number;
  status: BookStatus;
  /** YYYY-MM-DD you want this one finished by. Optional — otherwise the goal's
   *  deadline is shared out across everything still unread. */
  targetDate?: string;
  finishedAt?: string;
  createdAt: number;
}

export const BOOKS_KEY = "alfred.books";
export const BOOKS_CHANGED = "alfred.books:changed";

export function loadBooks(): Book[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BOOKS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Book[]) : [];
    return Array.isArray(parsed) ? parsed.filter(isBook) : [];
  } catch {
    return [];
  }
}

/** Defensive: a hand-edited or half-synced row shouldn't take the page down. */
function isBook(b: unknown): b is Book {
  return !!b && typeof b === "object" && typeof (b as Book).id === "string";
}

export function saveBooks(books: Book[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BOOKS_KEY, JSON.stringify(books));
  } catch {
    /* quota */
  }
  window.dispatchEvent(new Event(BOOKS_CHANGED));
}

export function booksForGoal(books: Book[], goalId: string): Book[] {
  return books.filter((b) => b.goalId === goalId);
}

/** Reading first, then want-to-read, then finished — the order you act in. */
const STATUS_ORDER: Record<BookStatus, number> = { reading: 0, want: 1, done: 2 };

export function sortBooks(books: Book[]): Book[] {
  return [...books].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.createdAt - b.createdAt,
  );
}

/* ---------- pace ---------- */

export interface BookPace {
  /** Pages a day to finish by `finishBy`. 0 when there's nothing left to read. */
  pagesPerDay: number;
  pagesLeft: number;
  daysLeft: number;
  /** YYYY-MM-DD this book needs to be done by. */
  finishBy: string;
  /** Whether that date is the book's own, or a slice of the goal's deadline. */
  source: "book" | "goal";
}

function toKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function daysBetween(from: Date, toDate: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * When each unfinished book needs to be done, if the goal's remaining time is
 * split evenly between them. Returns a map of book id -> YYYY-MM-DD.
 *
 * Reading order matters: the book you're already in gets the first slot, so its
 * deadline is the nearest one rather than an average of the whole shelf.
 */
export function goalDerivedDueDates(
  books: Book[],
  goal: Goal,
  now = new Date(),
): Record<string, string> {
  const deadline = parseDeadline(goal.deadline);
  const unfinished = sortBooks(books).filter((b) => b.status !== "done");
  if (!deadline || unfinished.length === 0) return {};

  const totalDays = daysBetween(now, deadline);
  if (totalDays <= 0) return {};

  const slice = totalDays / unfinished.length;
  const out: Record<string, string> = {};
  unfinished.forEach((b, i) => {
    const due = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    due.setDate(due.getDate() + Math.max(1, Math.round(slice * (i + 1))));
    out[b.id] = toKey(due);
  });
  return out;
}

/**
 * How hard this book is pushing today. Null when there's nothing to pace
 * against — no page count, or no date to work back from.
 */
export function bookPace(
  book: Book,
  goal: Goal,
  allBooksForGoal: Book[],
  now = new Date(),
): BookPace | null {
  if (book.status === "done") return null;
  if (!book.totalPages || book.totalPages <= 0) return null;

  const pagesLeft = Math.max(0, book.totalPages - book.pagesRead);
  if (pagesLeft === 0) return null;

  const ownDue = book.targetDate ? parseDeadline(book.targetDate) : null;
  const derived = ownDue ? null : goalDerivedDueDates(allBooksForGoal, goal, now)[book.id];
  const dueDate = ownDue ?? (derived ? parseDeadline(derived) : null);
  if (!dueDate) return null;

  // The due day itself is still a day you can read on.
  const daysLeft = Math.max(1, daysBetween(now, dueDate) + 1);

  return {
    pagesPerDay: pagesLeft / daysLeft,
    pagesLeft,
    daysLeft,
    finishBy: toKey(dueDate),
    source: ownDue ? "book" : "goal",
  };
}

/** Finished books — what the parent goal's progress should read. */
export function finishedCount(books: Book[]): number {
  return books.filter((b) => b.status === "done").length;
}
