import { describe, it, expect, beforeEach } from "vitest";
import {
  COMPLETION_LOG_KEY,
  loadCompletions,
  recordCompletion,
  clearCompletion,
  completionsFor,
  typicalCompletionHour,
  backfillCompletionLog,
} from "@/lib/completionLog";
import { mergeArrays } from "@/hooks/useCloudStateSync";

const at = (day: string, hour: number, min = 0) =>
  new Date(`${day}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`);

beforeEach(() => localStorage.clear());

describe("recording completions", () => {
  it("keeps one timestamped record per item per day", () => {
    recordCompletion("habit", "h1", at("2026-09-15", 7, 30));
    const all = loadCompletions();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ kind: "habit", itemId: "h1", date: "2026-09-15" });
    expect(new Date(all[0].at).getHours()).toBe(7);
  });

  it("is idempotent for the same item-day", () => {
    recordCompletion("habit", "h1", at("2026-09-15", 7));
    recordCompletion("habit", "h1", at("2026-09-15", 9));
    expect(loadCompletions()).toHaveLength(1);
  });

  it("separates the same item on different days", () => {
    recordCompletion("habit", "h1", at("2026-09-14", 7));
    recordCompletion("habit", "h1", at("2026-09-15", 8));
    expect(completionsFor("habit", "h1")).toHaveLength(2);
  });

  it("separates different kinds sharing an id", () => {
    recordCompletion("habit", "x", at("2026-09-15", 7));
    recordCompletion("recurring", "x", at("2026-09-15", 9));
    expect(completionsFor("habit", "x")).toHaveLength(1);
    expect(completionsFor("recurring", "x")).toHaveLength(1);
  });

  it("leaves no trace once un-ticked", () => {
    recordCompletion("habit", "h1", at("2026-09-15", 7));
    clearCompletion("habit", "h1", "2026-09-15");
    expect(loadCompletions()).toHaveLength(0);
  });

  it("only clears the day asked for", () => {
    recordCompletion("habit", "h1", at("2026-09-14", 7));
    recordCompletion("habit", "h1", at("2026-09-15", 7));
    clearCompletion("habit", "h1", "2026-09-15");
    expect(completionsFor("habit", "h1").map((r) => r.date)).toEqual(["2026-09-14"]);
  });

  it("survives a corrupt store", () => {
    localStorage.setItem(COMPLETION_LOG_KEY, "{not json");
    expect(loadCompletions()).toEqual([]);
    recordCompletion("habit", "h1", at("2026-09-15", 7));
    expect(loadCompletions()).toHaveLength(1);
  });
});

describe("typicalCompletionHour — the input for smart scheduling", () => {
  it("stays quiet until there's enough history to call it a pattern", () => {
    recordCompletion("habit", "h1", at("2026-09-13", 7));
    recordCompletion("habit", "h1", at("2026-09-14", 7));
    expect(typicalCompletionHour("habit", "h1")).toBeNull();
  });

  it("reports the usual hour once a pattern exists", () => {
    recordCompletion("habit", "h1", at("2026-09-13", 7));
    recordCompletion("habit", "h1", at("2026-09-14", 7));
    recordCompletion("habit", "h1", at("2026-09-15", 8));
    expect(typicalCompletionHour("habit", "h1")).toBe(7);
  });

  it("is not dragged off by a single outlier", () => {
    // A consistent morning habit with one 3am slip stays a morning habit.
    recordCompletion("habit", "h1", at("2026-09-11", 3));
    recordCompletion("habit", "h1", at("2026-09-12", 7));
    recordCompletion("habit", "h1", at("2026-09-13", 7));
    recordCompletion("habit", "h1", at("2026-09-14", 8));
    recordCompletion("habit", "h1", at("2026-09-15", 7));
    expect(typicalCompletionHour("habit", "h1")).toBe(7);
  });

  it("is per item, not global", () => {
    for (const d of ["2026-09-13", "2026-09-14", "2026-09-15"]) {
      recordCompletion("habit", "morning", at(d, 7));
      recordCompletion("habit", "evening", at(d, 21));
    }
    expect(typicalCompletionHour("habit", "morning")).toBe(7);
    expect(typicalCompletionHour("habit", "evening")).toBe(21);
  });
});

describe("backfill from the older per-kind maps", () => {
  it("imports habit times and recurring times", () => {
    const added = backfillCompletionLog(
      { "h1|2026-09-14": at("2026-09-14", 7).getTime() },
      { "t1:2026-09-14": at("2026-09-14", 9).getTime() },
    );
    expect(added).toBe(2);
    expect(completionsFor("habit", "h1")).toHaveLength(1);
    expect(completionsFor("recurring", "t1")).toHaveLength(1);
  });

  it("is idempotent across restarts", () => {
    const times = { "h1|2026-09-14": at("2026-09-14", 7).getTime() };
    backfillCompletionLog(times, {});
    expect(backfillCompletionLog(times, {})).toBe(0);
    expect(loadCompletions()).toHaveLength(1);
  });

  it("never overwrites a record that already exists", () => {
    recordCompletion("habit", "h1", at("2026-09-14", 6));
    backfillCompletionLog({ "h1|2026-09-14": at("2026-09-14", 23).getTime() }, {});
    expect(new Date(completionsFor("habit", "h1")[0].at).getHours()).toBe(6);
  });

  it("ignores malformed keys rather than inventing records", () => {
    const added = backfillCompletionLog(
      { "no-date-here": 123, "h1|not-a-date": 456, "|2026-09-14": 789 },
      {},
    );
    expect(added).toBe(0);
    expect(loadCompletions()).toEqual([]);
  });

  it("keeps ids containing the separator intact", () => {
    // Habit ids are uuids, but seed ids like "h-d1" and any future id with a
    // separator must still split on the LAST one.
    backfillCompletionLog({ "a|b|2026-09-14": at("2026-09-14", 7).getTime() }, {});
    expect(completionsFor("habit", "a|b")).toHaveLength(1);
  });
});

describe("cross-device merge", () => {
  it("collapses the same completion recorded on two devices", () => {
    // Union-merge keeps both rows (different ms); the reader must not count
    // one tick twice when working out the usual hour.
    const phone = [{ kind: "habit", itemId: "h1", date: "2026-09-15", at: at("2026-09-15", 7, 30).getTime() }];
    const laptop = [{ kind: "habit", itemId: "h1", date: "2026-09-15", at: at("2026-09-15", 7, 31).getTime() }];
    const merged = mergeArrays(phone, laptop, true);
    expect(merged).toHaveLength(2); // both survive the merge...

    localStorage.setItem(COMPLETION_LOG_KEY, JSON.stringify(merged));
    const read = loadCompletions();
    expect(read).toHaveLength(1); // ...but read back as one completion
    expect(new Date(read[0].at).getMinutes()).toBe(30); // earliest wins
  });
});
