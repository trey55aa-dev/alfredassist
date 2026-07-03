// Proactive Alfred: assembles a morning briefing and an evening review from the
// same local data the butler context reads — no AI call, so it always works and
// costs nothing. Rendered as a card on the Dashboard, timed to the hour.

import { todayKey } from "./alfred";
import { GOALS_KEY, type Goal } from "./goals";
import {
  HABITS_KEY,
  HABIT_LOGS_KEY,
  isCompleteForPeriod,
  type Habit,
  type HabitLog,
} from "./habits";
import { STREAK_KEY, type StreakState, emptyStreak, currentStreak } from "./streak";
import { isGoalDoneToday, paceHint } from "./goalDaily";
import { getTodayMoods, dailyAverage, moodLabel } from "./mood";
import { loadLocalEvents } from "./agendaStore";
import { filterToDay } from "./agenda";
import { getRecurringInstances } from "./recurring";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export type BriefingType = "morning" | "evening";
export type Tone = "gold" | "teal" | "coral" | "muted";

export interface BriefingItem {
  icon: string;
  text: string;
  tone: Tone;
}

export interface Briefing {
  type: BriefingType;
  greeting: string;
  headline: string;
  headlineTone: Tone;
  items: BriefingItem[];
  closer: string;
}

/** Which briefing (if any) belongs to this time of day. */
export function currentBriefingType(now = new Date()): BriefingType | null {
  const h = now.getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 18 && h <= 23) return "evening";
  return null;
}

/** True once there's anything to brief about (hides it on an empty account). */
export function hasBriefingData(): boolean {
  const habits = read<Habit[]>(HABITS_KEY, []).filter((h) => !h.archived);
  const goals = read<Goal[]>(GOALS_KEY, []).filter((g) => !g.done);
  return habits.length > 0 || goals.length > 0;
}

/* ---------- dismissal (once per period per day) ---------- */

const SEEN_KEY = "alfred.briefing.seen";
function seenMap(): Record<string, boolean> {
  return read<Record<string, boolean>>(SEEN_KEY, {});
}
function seenKey(type: BriefingType, date: string) {
  return `${date}:${type}`;
}
export function briefingSeen(type: BriefingType, date = todayKey()): boolean {
  return !!seenMap()[seenKey(type, date)];
}
export function markBriefingSeen(type: BriefingType, date = todayKey()): void {
  const m = seenMap();
  m[seenKey(type, date)] = true;
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(m));
  } catch {
    /* quota */
  }
}

/* ---------- stats ---------- */

interface Stats {
  total: number;
  done: number;
  remaining: number;
  streak: number;
  goalsToMove: Goal[];
  goalsMoved: number;
  events: number;
  firstEvent?: string;
  focus: { sessions: number; minutes: number };
  moodAvg: number | null;
}

function gather(now: Date): Stats {
  const today = todayKey(now);

  const habits = read<Habit[]>(HABITS_KEY, []).filter((h) => !h.archived);
  const logs = read<HabitLog[]>(HABIT_LOGS_KEY, []);
  const daily = habits.filter((h) => h.cadence === "daily");
  const done = daily.filter((h) => isCompleteForPeriod(h, logs)).length;
  const total = daily.length;

  const streak = currentStreak(read<StreakState>(STREAK_KEY, emptyStreak));

  const goals = read<Goal[]>(GOALS_KEY, []).filter((g) => !g.done);
  const goalsToMove = goals.filter((g) => !isGoalDoneToday(g.id));
  const goalsMoved = goals.filter((g) => isGoalDoneToday(g.id)).length;

  let events = 0;
  let firstEvent: string | undefined;
  try {
    const evAll = [
      ...filterToDay(loadLocalEvents(), now),
      ...getRecurringInstances(now),
    ].filter((e) => !e.allDay);
    events = evAll.length;
    const upcoming = evAll
      .map((e) => new Date(e.start))
      .filter((d) => d.getTime() >= now.getTime())
      .sort((a, b) => a.getTime() - b.getTime());
    firstEvent = upcoming[0]?.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    /* events optional */
  }

  const f = read<{ date?: string; sessions?: number; minutes?: number }>(
    "alfred.focus.stats",
    {},
  );
  const focus = f.date === today ? { sessions: f.sessions ?? 0, minutes: f.minutes ?? 0 } : { sessions: 0, minutes: 0 };

  const moodAvg = dailyAverage(getTodayMoods(), today);

  return { total, done, remaining: Math.max(0, total - done), streak, goalsToMove, goalsMoved, events, firstEvent, focus, moodAvg };
}

const p = (n: number) => (n === 1 ? "" : "s");

export function buildBriefing(type: BriefingType, now = new Date()): Briefing {
  const s = gather(now);
  return type === "morning" ? morning(s) : evening(s);
}

function morning(s: Stats): Briefing {
  let headline: string;
  let headlineTone: Tone;
  if (s.total === 0) {
    headline = "The slate is blank, sir. Shall we set today's protocol?";
    headlineTone = "muted";
  } else if (s.remaining === 0) {
    headline = s.streak > 0
      ? `Day ${s.streak} — and the protocol is already clear. Remarkable.`
      : "Today's protocol is already complete.";
    headlineTone = "teal";
  } else if (s.streak > 0) {
    headline = `Day ${s.streak} of the streak. ${s.remaining} habit${p(s.remaining)} to keep it alive.`;
    headlineTone = "gold";
  } else {
    headline = `${s.remaining} habit${p(s.remaining)} on today's protocol.`;
    headlineTone = "gold";
  }

  const items: BriefingItem[] = [];
  items.push(
    s.events > 0
      ? {
          icon: "📅",
          text: s.firstEvent
            ? `${s.events} engagement${p(s.events)} — next at ${s.firstEvent}.`
            : `${s.events} engagement${p(s.events)} today.`,
          tone: "teal",
        }
      : { icon: "📅", text: "Open road — nothing scheduled yet.", tone: "muted" },
  );
  if (s.goalsToMove.length > 0) {
    const top = s.goalsToMove[0];
    const hint = paceHint(top);
    items.push({
      icon: "🎯",
      text: `${s.goalsToMove.length} goal${p(s.goalsToMove.length)} ${
        s.goalsToMove.length === 1 ? "awaits" : "await"
      } a move${hint ? ` — ${top.title}: ${hint}` : `, starting with ${top.title}`}.`,
      tone: "gold",
    });
  }

  return {
    type: "morning",
    greeting: "Good morning, sir.",
    headline,
    headlineTone,
    items,
    closer: "At your service — let us begin the day.",
  };
}

function evening(s: Stats): Briefing {
  let headline: string;
  let headlineTone: Tone;
  if (s.total === 0) {
    headline = "A quiet day off the protocol, sir.";
    headlineTone = "muted";
  } else if (s.remaining === 0) {
    headline = `The streak holds — day ${s.streak}. Today is conquered.`;
    headlineTone = "teal";
  } else {
    headline = `You're ${s.remaining} habit${p(s.remaining)} from holding the streak.`;
    headlineTone = "coral";
  }

  const items: BriefingItem[] = [];
  if (s.total > 0) {
    items.push({ icon: "✅", text: `${s.done}/${s.total} habits complete.`, tone: s.remaining === 0 ? "teal" : "muted" });
  }
  items.push(
    s.goalsMoved > 0
      ? { icon: "🎯", text: `Progress logged on ${s.goalsMoved} goal${p(s.goalsMoved)}.`, tone: "gold" }
      : { icon: "🎯", text: "No goal progress logged today.", tone: "muted" },
  );
  if (s.focus.sessions > 0) {
    items.push({ icon: "⏱️", text: `${s.focus.sessions} focus session${p(s.focus.sessions)}, ${s.focus.minutes} min.`, tone: "teal" });
  }
  if (s.moodAvg != null) {
    items.push({ icon: "🙂", text: `Mood today: ${moodLabel(s.moodAvg)}.`, tone: "muted" });
  }

  const closer =
    s.total > 0 && s.remaining === 0
      ? "Rest well, sir. The campaign advances."
      : s.remaining > 0 && s.remaining <= 2
        ? "A little time remains to close the day out."
        : "Tomorrow is another chance to press forward.";

  return { type: "evening", greeting: "Good evening, sir.", headline, headlineTone, items, closer };
}
