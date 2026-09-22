// The single thing that would make today a win — set once each morning,
// looked back on at shutdown. Freeform text, one per day; no streak, no
// pass/fail, because turning it into another thing to fail at would defeat
// the point (grace before penalty).

const KEY = "alfred.dailyHighlight";

function readAll(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

export function getDailyHighlight(date: string): string {
  return readAll()[date] ?? "";
}

export function setDailyHighlight(date: string, text: string): void {
  const map = readAll();
  const trimmed = text.trim();
  if (trimmed) map[date] = trimmed;
  else delete map[date];
  writeAll(map);
}

/** Most recent highlights, newest first, skipping days with none set. */
export function recentHighlights(days: number, before = new Date()): { date: string; text: string }[] {
  const map = readAll();
  const out: { date: string; text: string }[] = [];
  const d = new Date(before);
  for (let i = 0; i < days; i++) {
    const p = (n: number) => String(n).padStart(2, "0");
    const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    if (map[key]) out.push({ date: key, text: map[key] });
    d.setDate(d.getDate() - 1);
  }
  return out;
}
