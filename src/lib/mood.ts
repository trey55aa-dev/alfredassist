import { todayKey } from "./alfred";

export const MOOD_KEY = "alfred.mood.log";
export const MOOD_CHANGED = "alfred.mood:changed";

export type CheckInType = "morning" | "evening" | "manual";

export interface MoodEntry {
  id: string;
  timestamp: number;       // ms since epoch
  date: string;            // YYYY-MM-DD
  type: CheckInType;
  /** 1 (very unpleasant) → 10 (very pleasant) */
  valence: number;
  labels: string[];        // mood descriptors
  associations: string[];  // what influenced the mood
  note?: string;
}

/* ─── Descriptors ─────────────────────────────────────── */

export const MOOD_LABELS: Record<"low" | "mid" | "high", string[]> = {
  low:  ["Anxious", "Sad", "Stressed", "Angry", "Tired", "Overwhelmed", "Lonely", "Frustrated", "Drained"],
  mid:  ["Okay", "Calm", "Indifferent", "Thoughtful", "Uncertain", "Restless"],
  high: ["Happy", "Grateful", "Energized", "Motivated", "Peaceful", "Content", "Hopeful", "Confident", "Excited", "Proud", "Inspired"],
};

export function labelsForValence(v: number): string[] {
  if (v <= 3) return MOOD_LABELS.low;
  if (v <= 6) return MOOD_LABELS.mid;
  return MOOD_LABELS.high;
}

export const MOOD_ASSOCIATIONS = [
  { id: "work",          label: "Work",          emoji: "💼" },
  { id: "health",        label: "Health",        emoji: "❤️" },
  { id: "relationships", label: "Relationships", emoji: "👥" },
  { id: "family",        label: "Family",        emoji: "🏠" },
  { id: "exercise",      label: "Exercise",      emoji: "💪" },
  { id: "sleep",         label: "Sleep",         emoji: "😴" },
  { id: "money",         label: "Money",         emoji: "💰" },
  { id: "goals",         label: "Goals",         emoji: "🎯" },
  { id: "creativity",    label: "Creativity",    emoji: "🎨" },
  { id: "nature",        label: "Nature",        emoji: "🌿" },
] as const;

/* ─── Emoji + color per valence ───────────────────────── */

const EMOJIS = ["", "😣","😢","😞","😕","😐","🙂","😊","😄","😁","🤩"];
export function moodEmoji(v: number): string { return EMOJIS[Math.round(v)] ?? "😐"; }

const COLORS = [
  "",
  "#4A6CF7", // 1 — deep blue
  "#6B5BF7", // 2 — indigo
  "#8B55E0", // 3 — purple
  "#AC50C8", // 4 — violet
  "#64A8DC", // 5 — steel blue
  "#2BB5B5", // 6 — teal
  "#2DB574", // 7 — green
  "#5EC96B", // 8 — light green
  "#A8CC42", // 9 — yellow-green
  "#D4AF37", // 10 — gold
];
export function moodColor(v: number): string { return COLORS[Math.round(v)] ?? COLORS[5]; }

export const MOOD_GRADIENT =
  `linear-gradient(to right, ${COLORS.slice(1).join(", ")})`;

/* ─── Storage ─────────────────────────────────────────── */

function dispatch() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(MOOD_CHANGED));
}

export function loadMoods(): MoodEntry[] {
  try {
    const raw = localStorage.getItem(MOOD_KEY);
    return raw ? (JSON.parse(raw) as MoodEntry[]) : [];
  } catch { return []; }
}

export function saveMoodEntry(entry: Omit<MoodEntry, "id" | "timestamp" | "date">): MoodEntry {
  const full: MoodEntry = {
    ...entry,
    id: `mood-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    date: todayKey(),
  };
  const all = loadMoods();
  const updated = [...all, full];
  try {
    localStorage.setItem(MOOD_KEY, JSON.stringify(updated));
  } catch { /* quota */ }
  dispatch();
  return full;
}

export function getTodayMoods(): MoodEntry[] {
  const today = todayKey();
  return loadMoods().filter((e) => e.date === today);
}

export function hasTodayCheckIn(type: CheckInType): boolean {
  return getTodayMoods().some((e) => e.type === type);
}

/** Average valence for a given YYYY-MM-DD, or null if no entries. */
export function dailyAverage(entries: MoodEntry[], date: string): number | null {
  const es = entries.filter((e) => e.date === date);
  if (!es.length) return null;
  return Math.round((es.reduce((s, e) => s + e.valence, 0) / es.length) * 10) / 10;
}
