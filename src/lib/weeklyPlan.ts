// Customizable weekly planner.
//
// The old planner was a fixed 5×7 grid of free-text boxes that went nowhere.
// This model makes it customizable (add/rename/remove your own areas), turns
// each cell into a checklist of items, and lets any item be promoted into the
// Daily Schedule as a recurring routine block — so the plan you draft here
// actually shows up in your calendar/agenda.
//
// Local-first (localStorage) — there's no Supabase column for the plan yet, so
// it degrades gracefully offline, mirroring how `financialType` is handled.

import {
  isApplicableToDate,
  isRecurringCompleted,
  isRecurringSkipped,
  loadTemplates,
} from "./recurring";
import { todayKey } from "./alfred";

export const WEEKLY_PLAN_KEY = "alfred.weeklyPlan.v1";
const LEGACY_GRID_KEY = "alfred.planner"; // old free-text grid

export const PLAN_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const PLAN_CHANGED = "alfred.weeklyPlan:changed";

/** Planner day index (0=Mon … 6=Sun) → JS getDay() dow (0=Sun … 6=Sat). */
export function planDayToDow(planIdx: number): number {
  return (planIdx + 1) % 7;
}

/** JS getDay() dow (0=Sun) → planner day index (0=Mon). */
export function dowToPlanDay(dow: number): number {
  return (dow + 6) % 7;
}

export interface PlanItem {
  id: string;
  text: string;
  emoji?: string;
  done?: boolean;
  /** When promoted to the schedule, the RecurringTemplate id it created. */
  templateId?: string;
}

export interface PlanArea {
  id: string;
  name: string;
  emoji?: string;
  color?: string; // bare HSL, matches EVENT_COLORS
}

export interface WeeklyPlan {
  areas: PlanArea[];
  /** key = `${areaId}|${dayIdx}` (dayIdx 0..6, Mon..Sun) → list of items */
  items: Record<string, PlanItem[]>;
}

export const DEFAULT_AREAS: PlanArea[] = [
  { id: "career", name: "Career / NIL", emoji: "💼", color: "45 80% 55%" },
  { id: "body", name: "Body", emoji: "💪", color: "150 40% 55%" },
  { id: "money", name: "Money", emoji: "💰", color: "175 55% 45%" },
  { id: "skills", name: "Skills", emoji: "🧠", color: "270 55% 65%" },
  { id: "life", name: "Life", emoji: "🌿", color: "200 70% 60%" },
];

export function cellKey(areaId: string, dayIdx: number): string {
  return `${areaId}|${dayIdx}`;
}

function dispatchChanged() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(PLAN_CHANGED));
}

/* ---------- Storage ---------- */

export function loadPlan(): WeeklyPlan {
  if (typeof window === "undefined") return { areas: DEFAULT_AREAS, items: {} };
  try {
    const raw = localStorage.getItem(WEEKLY_PLAN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WeeklyPlan;
      if (parsed && Array.isArray(parsed.areas) && parsed.items) return parsed;
    }
  } catch {
    /* fall through to migration */
  }
  // First run — migrate the legacy free-text grid if present.
  const migrated = migrateLegacyGrid();
  savePlan(migrated);
  return migrated;
}

export function savePlan(plan: WeeklyPlan): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WEEKLY_PLAN_KEY, JSON.stringify(plan));
  } catch {
    /* quota or disabled */
  }
  dispatchChanged();
}

/** Convert the old `alfred.planner` Record<"area|Day", text> grid into items. */
function migrateLegacyGrid(): WeeklyPlan {
  const plan: WeeklyPlan = { areas: [...DEFAULT_AREAS], items: {} };
  if (typeof window === "undefined") return plan;
  try {
    const raw = localStorage.getItem(LEGACY_GRID_KEY);
    if (!raw) return plan;
    const grid = JSON.parse(raw) as Record<string, string>;
    const LEGACY_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const nameToId: Record<string, string> = {
      "Career / NIL": "career",
      Body: "body",
      Money: "money",
      Skills: "skills",
      Life: "life",
    };
    for (const [k, text] of Object.entries(grid)) {
      if (!text || !text.trim()) continue;
      const [areaName, day] = k.split("|");
      const areaId = nameToId[areaName] ?? "life";
      const dayIdx = LEGACY_DAYS.indexOf(day);
      if (dayIdx < 0) continue;
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const ck = cellKey(areaId, dayIdx);
      plan.items[ck] = (plan.items[ck] ?? []).concat(
        lines.map((line) => ({ id: crypto.randomUUID(), text: line })),
      );
    }
  } catch {
    /* ignore malformed legacy data */
  }
  return plan;
}

/* ---------- Mutators (pure — return a new plan) ---------- */

export function addItem(
  plan: WeeklyPlan,
  areaId: string,
  dayIdx: number,
  text: string,
): WeeklyPlan {
  const ck = cellKey(areaId, dayIdx);
  const item: PlanItem = { id: crypto.randomUUID(), text: text.trim() };
  return { ...plan, items: { ...plan.items, [ck]: [...(plan.items[ck] ?? []), item] } };
}

export function updateItem(
  plan: WeeklyPlan,
  areaId: string,
  dayIdx: number,
  itemId: string,
  patch: Partial<PlanItem>,
): WeeklyPlan {
  const ck = cellKey(areaId, dayIdx);
  const list = (plan.items[ck] ?? []).map((it) =>
    it.id === itemId ? { ...it, ...patch } : it,
  );
  return { ...plan, items: { ...plan.items, [ck]: list } };
}

export function removeItem(
  plan: WeeklyPlan,
  areaId: string,
  dayIdx: number,
  itemId: string,
): WeeklyPlan {
  const ck = cellKey(areaId, dayIdx);
  const list = (plan.items[ck] ?? []).filter((it) => it.id !== itemId);
  return { ...plan, items: { ...plan.items, [ck]: list } };
}

/** Copy an item to every day of the week (Mon–Sun) within the same area. */
export function repeatItemAllWeek(
  plan: WeeklyPlan,
  areaId: string,
  dayIdx: number,
  itemId: string,
): WeeklyPlan {
  const src = (plan.items[cellKey(areaId, dayIdx)] ?? []).find((it) => it.id === itemId);
  if (!src) return plan;
  const items = { ...plan.items };
  for (let d = 0; d < 7; d++) {
    if (d === dayIdx) continue;
    const ck = cellKey(areaId, d);
    const exists = (items[ck] ?? []).some(
      (it) => it.text.toLowerCase() === src.text.toLowerCase(),
    );
    if (exists) continue;
    items[ck] = [...(items[ck] ?? []), { id: crypto.randomUUID(), text: src.text, emoji: src.emoji }];
  }
  return { ...plan, items };
}

export function addArea(plan: WeeklyPlan, name: string): WeeklyPlan {
  const area: PlanArea = {
    id: crypto.randomUUID(),
    name: name.trim(),
    emoji: "📌",
    color: "270 40% 55%",
  };
  return { ...plan, areas: [...plan.areas, area] };
}

export function updateArea(
  plan: WeeklyPlan,
  areaId: string,
  patch: Partial<PlanArea>,
): WeeklyPlan {
  return {
    ...plan,
    areas: plan.areas.map((a) => (a.id === areaId ? { ...a, ...patch } : a)),
  };
}

export function removeArea(plan: WeeklyPlan, areaId: string): WeeklyPlan {
  const items = { ...plan.items };
  for (let d = 0; d < 7; d++) delete items[cellKey(areaId, d)];
  return { areas: plan.areas.filter((a) => a.id !== areaId), items };
}

/* ---------- Adaptive usage analysis ---------- */

export type SuggestionKind = "win" | "slip" | "promote";

export interface PlanSuggestion {
  id: string;
  kind: SuggestionKind;
  title: string;
  detail: string;
  /** "promote" only — the plan item to turn into a routine. */
  item?: PlanItem;
  areaId?: string;
  dayIdx?: number;
  /** "win" / "slip" — the template the insight is about. */
  templateId?: string;
}

/**
 * Look at how the user actually followed their schedule over the last
 * `lookbackDays` and surface adaptive suggestions:
 *  - "win"     → a routine block they're nailing (≥70% of applicable days)
 *  - "slip"    → a block they keep missing (reschedule or pause)
 *  - "promote" → a plan item they drafted but never scheduled
 *
 * Non-destructive: these are suggestions the user acts on, never auto-applied.
 */
export function analyzeUsage(plan: WeeklyPlan, lookbackDays = 14): PlanSuggestion[] {
  const wins: PlanSuggestion[] = [];
  const slips: PlanSuggestion[] = [];
  const promotes: PlanSuggestion[] = [];

  const templates = loadTemplates();
  for (const t of templates) {
    if (!t.enabled) continue;
    let applicable = 0;
    let completed = 0;
    for (let i = 0; i < lookbackDays; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (!isApplicableToDate(t, d)) continue;
      applicable++;
      const ds = todayKey(d);
      if (isRecurringCompleted(t.id, ds)) completed++;
      else void isRecurringSkipped(t.id, ds); // skip counts as a miss
    }
    if (applicable < 3) continue; // not enough signal yet
    const rate = completed / applicable;
    if (rate >= 0.7) {
      wins.push({
        id: `win-${t.id}`,
        kind: "win",
        title: `${t.emoji ?? "🔥"} "${t.title}" is sticking`,
        detail: `Done ${completed}/${applicable} days. This routine is working — keep it.`,
        templateId: t.id,
      });
    } else if (applicable - completed >= 3 && rate < 0.4) {
      slips.push({
        id: `slip-${t.id}`,
        kind: "slip",
        title: `${t.emoji ?? "⚠️"} "${t.title}" keeps slipping`,
        detail: `Only ${completed}/${applicable} days. Try a different time, or pause it.`,
        templateId: t.id,
      });
    }
  }

  // Plan items drafted but never pushed to the schedule.
  for (const area of plan.areas) {
    for (let day = 0; day < 7; day++) {
      for (const it of plan.items[cellKey(area.id, day)] ?? []) {
        if (it.templateId || it.done) continue;
        promotes.push({
          id: `promote-${it.id}`,
          kind: "promote",
          title: `Schedule "${it.text}"`,
          detail: `${area.name} · ${PLAN_DAYS[day]} — turn it into a routine block.`,
          item: it,
          areaId: area.id,
          dayIdx: day,
        });
      }
    }
  }

  // Keep it tidy: all wins/slips, but cap promote nudges.
  return [...slips, ...wins, ...promotes.slice(0, 3)];
}
