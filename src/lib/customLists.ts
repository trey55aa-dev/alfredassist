export interface CustomListItem {
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
