// A short free-text note the user can leave for a given day — "how did today
// actually go." Grounds the daily recap and gives the retime suggester (and,
// eventually, Alfred's coaching) something beyond raw checkbox data.

const FEEDBACK_KEY = "alfred.dailyFeedback";

function readAll(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(FEEDBACK_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function getDailyFeedback(dateStr: string): string {
  return readAll()[dateStr] ?? "";
}

export function setDailyFeedback(dateStr: string, text: string): void {
  if (typeof window === "undefined") return;
  const all = readAll();
  const trimmed = text.trim();
  if (trimmed) all[dateStr] = trimmed;
  else delete all[dateStr];
  try {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(all));
  } catch {
    /* quota */
  }
}
