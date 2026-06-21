import { todayKey } from "./alfred";

export const MOOD_KEY     = "alfred.mood.log";
export const MOOD_CHANGED = "alfred.mood:changed";

export type CheckInType = "morning" | "evening" | "manual";

export interface MoodEntry {
  id: string;
  timestamp: number;
  date: string;
  type: CheckInType;
  /** 1 (very unpleasant) → 7 (very pleasant) */
  valence: number;
  labels: string[];
  associations: string[];
  note?: string;
  /** What made this moment special (or what's weighing on you) */
  special?: string;
}

/* ─── 7-point scale labels ────────────────────────────── */

export const VALENCE_LABELS = [
  "",                   // 0 unused
  "Very Unpleasant",    // 1
  "Unpleasant",         // 2
  "Slightly Unpleasant",// 3
  "Neutral",            // 4
  "Slightly Pleasant",  // 5
  "Pleasant",           // 6
  "Very Pleasant",      // 7
] as const;

export function moodLabel(v: number): string {
  const idx = Math.min(7, Math.max(1, Math.round(v)));
  return VALENCE_LABELS[idx];
}

/* ─── Descriptor chips per range ──────────────────────── */

export const MOOD_LABELS: Record<"low" | "mid" | "high", string[]> = {
  low:  ["Anxious", "Sad", "Stressed", "Angry", "Tired", "Overwhelmed", "Lonely", "Frustrated", "Drained"],
  mid:  ["Okay", "Calm", "Indifferent", "Thoughtful", "Uncertain", "Restless"],
  high: ["Happy", "Grateful", "Energized", "Motivated", "Peaceful", "Content", "Hopeful", "Confident", "Excited", "Proud", "Inspired"],
};

export function labelsForValence(v: number): string[] {
  if (v <= 2) return MOOD_LABELS.low;
  if (v <= 4) return MOOD_LABELS.mid;
  return MOOD_LABELS.high;
}

/* ─── Associations ────────────────────────────────────── */

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

/* ─── Color per valence (1–7) ─────────────────────────── */

const COLORS = [
  "",
  "#4A6CF7", // 1 — deep blue (very unpleasant)
  "#6B5BF7", // 2 — indigo
  "#9B59CC", // 3 — purple
  "#3A9FC8", // 4 — steel blue (neutral)
  "#2BB5B5", // 5 — teal
  "#2DB574", // 6 — green
  "#D4AF37", // 7 — gold (very pleasant)
];

export function moodColor(v: number): string {
  return COLORS[Math.min(7, Math.max(1, Math.round(v)))] ?? COLORS[4];
}

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

export function saveMoodEntry(
  entry: Omit<MoodEntry, "id" | "timestamp" | "date">,
): MoodEntry {
  const full: MoodEntry = {
    ...entry,
    id: `mood-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    date: todayKey(),
  };
  const all = loadMoods();
  try {
    localStorage.setItem(MOOD_KEY, JSON.stringify([...all, full]));
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

export function dailyAverage(entries: MoodEntry[], date: string): number | null {
  const es = entries.filter((e) => e.date === date);
  if (!es.length) return null;
  return Math.round((es.reduce((s, e) => s + e.valence, 0) / es.length) * 10) / 10;
}
