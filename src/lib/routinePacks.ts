// Preset routine packs — one-tap bundles users can install in seconds.
import type { RecurringTemplate, RecurrenceType } from "./recurring";

export interface PackBlock {
  title: string;
  emoji: string;
  color: string;       // bare HSL
  startTime: string;   // HH:MM
  endTime: string;     // HH:MM
  recurrence: RecurrenceType;
  days?: number[];
}

export interface RoutinePack {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  color: string;       // accent color for the pack card
  blocks: PackBlock[];
}

export const ROUTINE_PACKS: RoutinePack[] = [
  {
    id: "morning",
    name: "Morning Routine",
    emoji: "☀️",
    tagline: "Start the day with intention",
    color: "45 80% 55%",
    blocks: [
      { title: "Wake up",              emoji: "🌅", color: "45 80% 55%",  startTime: "06:00", endTime: "06:10", recurrence: "daily" },
      { title: "Hydrate + vitamins",   emoji: "💧", color: "200 70% 60%", startTime: "06:10", endTime: "06:20", recurrence: "daily" },
      { title: "Workout",              emoji: "💪", color: "150 40% 55%", startTime: "06:30", endTime: "07:30", recurrence: "daily" },
      { title: "Shower & groom",       emoji: "🚿", color: "200 70% 60%", startTime: "07:30", endTime: "08:00", recurrence: "daily" },
      { title: "Breakfast",            emoji: "🍳", color: "30 85% 60%",  startTime: "08:00", endTime: "08:30", recurrence: "daily" },
      { title: "Journal / review goals", emoji: "📓", color: "270 40% 55%", startTime: "08:30", endTime: "09:00", recurrence: "daily" },
    ],
  },
  {
    id: "night",
    name: "Night Routine",
    emoji: "🌙",
    tagline: "Wind down and recover",
    color: "220 15% 55%",
    blocks: [
      { title: "Phone down",          emoji: "📵", color: "220 15% 55%", startTime: "21:30", endTime: "21:35", recurrence: "daily" },
      { title: "Read",                emoji: "📚", color: "270 40% 55%", startTime: "21:35", endTime: "22:00", recurrence: "daily" },
      { title: "Meditate / stretch",  emoji: "🧘", color: "150 40% 55%", startTime: "22:00", endTime: "22:20", recurrence: "daily" },
      { title: "Hygiene prep",        emoji: "🦷", color: "200 70% 60%", startTime: "22:20", endTime: "22:35", recurrence: "daily" },
      { title: "Lights out",          emoji: "😴", color: "220 15% 55%", startTime: "22:35", endTime: "23:00", recurrence: "daily" },
    ],
  },
  {
    id: "workday",
    name: "Work Day",
    emoji: "💼",
    tagline: "Structured focus blocks Mon–Fri",
    color: "45 80% 55%",
    blocks: [
      { title: "Deep work — block 1", emoji: "🧠", color: "45 80% 55%",  startTime: "09:00", endTime: "11:00", recurrence: "weekdays" },
      { title: "Lunch break",         emoji: "🍽️", color: "30 85% 60%",  startTime: "12:00", endTime: "13:00", recurrence: "weekdays" },
      { title: "Deep work — block 2", emoji: "💻", color: "45 80% 55%",  startTime: "13:00", endTime: "15:00", recurrence: "weekdays" },
      { title: "Review & wrap-up",    emoji: "📋", color: "150 40% 55%", startTime: "16:30", endTime: "17:00", recurrence: "weekdays" },
    ],
  },
  {
    id: "fitness",
    name: "Fitness Block",
    emoji: "🏋️",
    tagline: "Hit your body goals every day",
    color: "150 40% 55%",
    blocks: [
      { title: "Warm-up",             emoji: "🔥", color: "30 85% 60%",  startTime: "06:30", endTime: "06:45", recurrence: "daily" },
      { title: "Workout",             emoji: "💪", color: "150 40% 55%", startTime: "06:45", endTime: "07:30", recurrence: "daily" },
      { title: "Cool-down / stretch", emoji: "🧘", color: "175 55% 45%", startTime: "07:30", endTime: "07:45", recurrence: "daily" },
      { title: "Protein + recovery",  emoji: "🥤", color: "45 80% 55%",  startTime: "07:45", endTime: "08:00", recurrence: "daily" },
    ],
  },
];

/** Convert a pack block into a RecurringTemplate (without id/enabled — caller sets those). */
export function packBlockToTemplate(
  block: PackBlock,
  routineGroup: string,
): Omit<RecurringTemplate, "id" | "enabled"> {
  return {
    title: block.title,
    emoji: block.emoji,
    color: block.color,
    startTime: block.startTime,
    endTime: block.endTime,
    recurrence: block.recurrence,
    days: block.days,
    routineGroup,
  };
}

/** Check if a given pack is already (partially) installed by group name. */
export function packInstalledCount(
  templates: RecurringTemplate[],
  packName: string,
): number {
  return templates.filter((t) => t.routineGroup === packName).length;
}
