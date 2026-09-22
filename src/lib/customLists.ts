export interface CustomListItem {
  id: string;
  text: string;
  done: boolean;
  // How long this item is expected to take — powers the list's time-budget bar.
  estimatedMinutes?: number;
  // Lightweight checklist steps within the item. No estimate of their own —
  // they're a breakdown of the parent, not separate budget line items.
  subtasks?: CustomListSubtask[];
}

export interface CustomListSubtask {
  id: string;
  text: string;
  done: boolean;
}

export interface CustomList {
  id: string;
  title: string;
  emoji?: string;
  color?: string; // hsl token e.g. "var(--gold)" or hex
  items: CustomListItem[];
  createdAt: number;
}

export const CUSTOM_LISTS_KEY = "alfred.customLists";

export const LIST_COLORS = [
  { name: "Gold", value: "45 80% 55%" },
  { name: "Rose", value: "350 70% 60%" },
  { name: "Sky", value: "200 70% 60%" },
  { name: "Sage", value: "150 40% 55%" },
  { name: "Amber", value: "30 85% 60%" },
  { name: "Violet", value: "270 55% 65%" },
];

export const LIST_EMOJIS = ["✨", "🎯", "📚", "💪", "🌿", "☕", "🧠", "🔥", "🛫", "🍳", "🎨", "💼"];

export const SEED_LISTS: CustomList[] = [
  {
    id: "list-morning",
    title: "Morning Routine",
    emoji: "☕",
    color: LIST_COLORS[0].value,
    items: [
      { id: "i1", text: "Drink a glass of water", done: false },
      { id: "i2", text: "Stretch for 5 minutes", done: false },
      { id: "i3", text: "Review today's top 3", done: false },
    ],
    createdAt: Date.now(),
  },
];

export function newList(title: string): CustomList {
  return {
    id: crypto.randomUUID(),
    title: title.trim() || "Untitled list",
    emoji: LIST_EMOJIS[Math.floor(Math.random() * LIST_EMOJIS.length)],
    color: LIST_COLORS[0].value,
    items: [],
    createdAt: Date.now(),
  };
}

export function newItem(text: string): CustomListItem {
  return { id: crypto.randomUUID(), text: text.trim(), done: false };
}

export function newSubtask(text: string): CustomListSubtask {
  return { id: crypto.randomUUID(), text: text.trim(), done: false };
}

/** Common estimate presets shown as quick-pick chips. */
export const ESTIMATE_PRESETS_MIN = [15, 30, 45, 60, 90, 120];

export function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

/**
 * Time budget for a list: total estimated minutes across items that have an
 * estimate, and how much of that is done. Items without an estimate don't
 * count toward either side — an all-or-nothing list (no estimates at all)
 * has no time budget to show, distinct from a fully-planned list at 0% done.
 */
export function listMinutesSummary(list: Pick<CustomList, "items">): {
  totalMinutes: number;
  doneMinutes: number;
} {
  let totalMinutes = 0;
  let doneMinutes = 0;
  for (const item of list.items) {
    if (!item.estimatedMinutes) continue;
    totalMinutes += item.estimatedMinutes;
    if (item.done) doneMinutes += item.estimatedMinutes;
  }
  return { totalMinutes, doneMinutes };
}
