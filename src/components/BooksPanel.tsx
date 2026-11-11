// The reading list for a "read N books" goal: what you want to read, what
// you're in now, and what today's pace actually is for each one.

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Goal } from "@/lib/goals";
import {
  BOOKS_CHANGED,
  bookPace,
  booksForGoal,
  finishedCount,
  loadBooks,
  saveBooks,
  sortBooks,
  type Book,
  type BookStatus,
} from "@/lib/books";

const STATUS_LABEL: Record<BookStatus, string> = {
  want: "Want to read",
  reading: "Reading now",
  done: "Finished",
};

function friendly(date: string): string {
  const d = new Date(date + "T00:00:00");
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function BooksPanel({
  goal,
  onChange,
}: {
  goal: Goal;
  onChange: (patch: Partial<Goal>) => void;
}) {
  const [all, setAll] = useState<Book[]>(() => loadBooks());
  const [title, setTitle] = useState("");
  const [pages, setPages] = useState("");

  useEffect(() => {
    const onExternal = () => setAll(loadBooks());
    window.addEventListener(BOOKS_CHANGED, onExternal);
    window.addEventListener(`alfred.ls:alfred.books`, onExternal);
    return () => {
      window.removeEventListener(BOOKS_CHANGED, onExternal);
      window.removeEventListener(`alfred.ls:alfred.books`, onExternal);
    };
  }, []);

  const mine = useMemo(() => sortBooks(booksForGoal(all, goal.id)), [all, goal.id]);

  const commit = (next: Book[]) => {
    setAll(next);
    saveBooks(next);
    // The goal's number and the shelf must agree — a finished book *is* progress.
    const done = finishedCount(booksForGoal(next, goal.id));
    if (done !== (goal.current ?? 0)) {
      onChange({ current: done, localUpdatedAt: Date.now() } as Partial<Goal>);
    }
  };

  const addBook = () => {
    const t = title.trim();
    if (!t) return;
    const n = Number(pages.replace(/[^0-9]/g, ""));
    commit([
      ...all,
      {
        id: crypto.randomUUID(),
        goalId: goal.id,
        title: t,
        totalPages: n > 0 ? n : undefined,
        pagesRead: 0,
        status: "want",
        createdAt: Date.now(),
      },
    ]);
    setTitle("");
    setPages("");
  };

  const patchBook = (id: string, patch: Partial<Book>) =>
    commit(all.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const setStatus = (b: Book, status: BookStatus) =>
    patchBook(b.id, {
      status,
      finishedAt: status === "done" ? new Date().toISOString().slice(0, 10) : undefined,
      // Finishing fills the page count in so the shelf stays self-consistent.
      pagesRead: status === "done" && b.totalPages ? b.totalPages : b.pagesRead,
    });

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-background/30 p-3">
      <div className="flex items-center gap-2">
        <BookOpen className="h-3.5 w-3.5 text-gold" />
        <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
          Reading list
        </span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {finishedCount(mine)} finished
          {typeof goal.target === "number" ? ` of ${goal.target}` : ""}
        </span>
      </div>

      {/* Add a book */}
      <div className="flex gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addBook()}
          placeholder="Book title"
          className="h-8 flex-1 text-xs"
        />
        <Input
          value={pages}
          onChange={(e) => setPages(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addBook()}
          placeholder="Pages"
          inputMode="numeric"
          className="h-8 w-20 text-xs"
        />
        <Button
          size="sm"
          onClick={addBook}
          disabled={!title.trim()}
          className="h-8 shrink-0 px-2"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {mine.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Add the books you want to read. With a page count, Alfred works out how many
          pages a day each one needs to land before {goal.deadline ? "the deadline" : "you set a deadline"}.
        </p>
      )}

      <div className="space-y-2">
        {mine.map((b) => {
          const pace = bookPace(b, goal, mine);
          return (
            <div key={b.id} className="rounded-md border border-border/50 bg-background/40 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-xs ${b.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}
                  >
                    {b.title}
                  </div>
                  <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-muted-foreground mt-0.5">
                    {STATUS_LABEL[b.status]}
                    {b.totalPages ? ` · ${b.pagesRead}/${b.totalPages} pages` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => commit(all.filter((x) => x.id !== b.id))}
                  className="shrink-0 text-muted-foreground/50 hover:text-destructive"
                  aria-label={`Remove ${b.title}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              {/* The whole point: what this book asks of you today. */}
              {pace && b.status !== "want" && (
                <div className="mt-1.5 font-mono text-[10px] text-teal">
                  {Math.ceil(pace.pagesPerDay)} pages/day · {pace.pagesLeft} left, finish by{" "}
                  {friendly(pace.finishBy)}
                  {pace.source === "goal" ? " to stay on for the goal" : ""}
                </div>
              )}
              {pace && b.status === "want" && (
                <div className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                  Slot opens up to {friendly(pace.finishBy)} · {Math.ceil(pace.pagesPerDay)} pages/day
                  once you start
                </div>
              )}
              {!b.totalPages && b.status !== "done" && (
                <div className="mt-1.5 font-mono text-[10px] text-muted-foreground/60">
                  Add a page count to see a daily pace.
                </div>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {b.status !== "reading" && b.status !== "done" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatus(b, "reading")}
                    className="h-6 px-2 text-[10px]"
                  >
                    Start reading
                  </Button>
                )}
                {b.status === "reading" && b.totalPages && (
                  <Input
                    value={String(b.pagesRead)}
                    onChange={(e) =>
                      patchBook(b.id, {
                        pagesRead: Math.max(
                          0,
                          Math.min(b.totalPages!, Number(e.target.value.replace(/[^0-9]/g, "")) || 0),
                        ),
                      })
                    }
                    inputMode="numeric"
                    aria-label={`Pages read of ${b.title}`}
                    className="h-6 w-16 text-[11px]"
                  />
                )}
                {b.status !== "done" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatus(b, "done")}
                    className="h-6 border-teal/40 px-2 text-[10px] text-teal hover:bg-teal/10"
                  >
                    <Check className="mr-1 h-3 w-3" />
                    Finished
                  </Button>
                )}
                {b.status === "done" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setStatus(b, "reading")}
                    className="h-6 px-2 text-[10px] text-muted-foreground"
                  >
                    Reopen
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
