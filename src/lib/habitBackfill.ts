// A record of which habit ticks were added after the fact.
//
// Backfilling a missed day is a normal, legitimate thing to do — you did the
// thing and forgot to tick it. But a number you can edit is a number you can
// stop trusting, so every retroactive tick is written down here with when it
// was added. The UI can then show "27 logged as you went, 2 added later",
// which keeps adherence honest without making the user defend it.
//
// Device-local by origin, but synced (see SYNCED_KEYS) so the audit trail
// follows the data it describes. The cloud habit_logs table stores only
// (habit, date), so this can't live alongside the log rows themselves.

export const HABIT_BACKFILL_KEY = "alfred.habitBackfills";
export const HABIT_BACKFILL_CHANGED = "alfred.habitBackfills:changed";

/** `${habitId}|${date}` -> epoch ms when the tick was added retroactively. */
export type BackfillLedger = Record<string, number>;

export function backfillKey(habitId: string, date: string): string {
  return `${habitId}|${date}`;
}

export function loadBackfills(): BackfillLedger {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(HABIT_BACKFILL_KEY);
    return raw ? (JSON.parse(raw) as BackfillLedger) : {};
  } catch {
    return {};
  }
}

function save(ledger: BackfillLedger): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HABIT_BACKFILL_KEY, JSON.stringify(ledger));
  } catch {
    /* quota */
  }
  window.dispatchEvent(new Event(HABIT_BACKFILL_CHANGED));
}

export function markBackfilled(habitId: string, date: string, at = Date.now()): void {
  const ledger = loadBackfills();
  ledger[backfillKey(habitId, date)] = at;
  save(ledger);
}

/** Undo the record — used when a retroactive tick is taken back off. */
export function clearBackfill(habitId: string, date: string): void {
  const ledger = loadBackfills();
  delete ledger[backfillKey(habitId, date)];
  save(ledger);
}

export function isBackfilled(ledger: BackfillLedger, habitId: string, date: string): boolean {
  return ledger[backfillKey(habitId, date)] !== undefined;
}

/** How many ticks in a given date range were added after the fact. */
export function countBackfillsInRange(
  ledger: BackfillLedger,
  fromDate: string,
  toDate: string,
): number {
  let n = 0;
  for (const key of Object.keys(ledger)) {
    const date = key.slice(key.indexOf("|") + 1);
    if (date >= fromDate && date <= toDate) n++;
  }
  return n;
}

/**
 * Whether a date may be edited at all. Guards the two ways a backfill could
 * produce data that isn't true: claiming a day that hasn't happened, and
 * claiming a day from before the challenge existed.
 */
export function canEditDate(date: string, challengeStart: string, today: string): boolean {
  return date >= challengeStart && date < today;
}
