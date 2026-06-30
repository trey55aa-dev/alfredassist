// Supabase-backed storage for goals. The Goal type stays unchanged; this layer
// maps between the camelCase client shape and snake_case DB rows.
//
// Schema lives in the user's Supabase: table `public.goals`, RLS restricts to
// the signed-in user, unique on (user_id, client_id). Goal.id is stored as
// client_id so existing seed ids ("g1", "g2", ...) keep working.

import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import type { Goal, GoalCategory, GoalQuarter, GoalSubStep, GoalTimeframe, GoalType, DailyEntry, RelapseEntry } from "./goals";

type GoalInsert = TablesInsert<"goals">;

interface GoalRow {
  id: string;
  user_id: string;
  client_id: string;
  title: string;
  category: string;
  timeframe: string;
  quarter: string | null;
  deadline: string | null;
  target: number | null;
  current_value: number | null;
  unit: string | null;
  done: boolean;
  note: string | null;
  sub_steps: GoalSubStep[] | null;
  plan_summary: string | null;
  plan_start_date: string | null;
  tags: string[] | null;
  progress_log: Record<string, number> | null;
  last_check_in: string | null;
  goal_type: string | null;
  streak_start: string | null;
  daily_log: Record<string, DailyEntry> | null;
  relapse_log: RelapseEntry[] | null;
  created_at: string;
  updated_at: string;
}

function rowToGoal(row: GoalRow): Goal {
  return {
    id: row.client_id,
    title: row.title,
    category: (row.category as GoalCategory) ?? "Life",
    timeframe: (row.timeframe as GoalTimeframe) ?? "annual",
    quarter: (row.quarter as GoalQuarter) ?? null,
    deadline: row.deadline ?? undefined,
    target: row.target ?? undefined,
    current: row.current_value ?? undefined,
    unit: row.unit ?? undefined,
    done: row.done,
    note: row.note ?? undefined,
    subSteps: row.sub_steps ?? undefined,
    planSummary: row.plan_summary ?? undefined,
    planStartDate: row.plan_start_date ?? undefined,
    tags: row.tags ?? undefined,
    progressLog: row.progress_log ?? undefined,
    lastCheckIn: row.last_check_in ?? undefined,
    goalType: (row.goal_type as GoalType | null) ?? undefined,
    streakStart: row.streak_start ?? undefined,
    dailyLog: row.daily_log ?? undefined,
    relapseLog: row.relapse_log ?? undefined,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

// The streak/log columns (goal_type, streak_start, daily_log, relapse_log) ship
// in the 20260620 migration. To stay safe whether or not that migration has been
// applied yet, the client includes them by default but, if the DB rejects them as
// unknown columns, strips them and retries — then remembers to skip them so goal
// saves never break. (Re-enable by clearing localStorage["alfred.goals.extCols"].)
const EXTENDED_COLUMNS = ["goal_type", "streak_start", "daily_log", "relapse_log"] as const;
const EXT_FLAG_KEY = "alfred.goals.extCols";

function extendedColumnsAvailable(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(EXT_FLAG_KEY) !== "0";
}

function markExtendedColumnsMissing(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(EXT_FLAG_KEY, "0");
  } catch {
    /* quota or disabled */
  }
}

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "PGRST204" || // PostgREST: column not found in schema cache
    code === "42703" || // Postgres: undefined_column
    (msg.includes("column") && (msg.includes("does not exist") || msg.includes("schema cache"))) ||
    msg.includes("could not find the")
  );
}

function stripExtended(row: GoalInsert): GoalInsert {
  const clone: Record<string, unknown> = { ...row };
  for (const c of EXTENDED_COLUMNS) delete clone[c];
  return clone as GoalInsert;
}

/* ---------- adaptive missing-column handling ----------
   The live schema can be missing columns from un-applied migrations (e.g.
   progress_log / last_check_in from 20260524). Previously a single unknown
   column failed the ENTIRE goal upsert, silently dropping edits like deadlines.
   Instead we strip whatever column the DB reports as missing and retry,
   remembering it so later saves skip it. The core columns (title, deadline,
   target, done, …) always exist since the initial migration, so the goal — and
   its deadline — still saves even on an un-migrated database. */

const MISSING_COLS_KEY = "alfred.goals.missingCols";

function loadMissingCols(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(MISSING_COLS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function rememberMissingCol(name: string): void {
  if (typeof window === "undefined") return;
  const set = loadMissingCols();
  if (set.has(name)) return;
  set.add(name);
  try {
    localStorage.setItem(MISSING_COLS_KEY, JSON.stringify([...set]));
  } catch {
    /* quota */
  }
}

/** Pull the offending column name out of a missing-column error message.
 *  Handles PostgREST ("…'progress_log' column of 'goals'…") and Postgres
 *  ("column \"progress_log\" of relation \"goals\"…"). */
function missingColumnName(error: { message?: string } | null): string | null {
  const msg = error?.message ?? "";
  const names = [...msg.matchAll(/['"]([a-z_][a-z0-9_]*)['"]/gi)]
    .map((m) => m[1])
    .filter((c) => c !== "goals"); // ignore the table name itself
  return names[0] ?? null;
}

function stripCols(row: GoalInsert, cols: Set<string>): GoalInsert {
  if (cols.size === 0) return row;
  const clone: Record<string, unknown> = { ...row };
  for (const c of cols) delete clone[c];
  return clone as GoalInsert;
}

/** Upsert goal rows, transparently stripping (and remembering) any column the
 *  live schema doesn't have — so a missing analytics column never blocks saving
 *  the core goal. */
async function upsertGoalRows(rows: GoalInsert[]): Promise<void> {
  let attempt = rows.map((r) => stripCols(r, loadMissingCols()));
  for (let i = 0; i < 12; i++) {
    const { error } = await supabase
      .from("goals")
      .upsert(attempt, { onConflict: "user_id,client_id" });
    if (!error) return;
    if (!isMissingColumnError(error)) throw new Error(error.message);

    const col = missingColumnName(error);
    if (!col) {
      // Couldn't parse the column name — fall back to dropping the known extended
      // set once, then give up if it still fails.
      markExtendedColumnsMissing();
      const { error: e2 } = await supabase
        .from("goals")
        .upsert(attempt.map(stripExtended), { onConflict: "user_id,client_id" });
      if (!e2) return;
      throw new Error(e2.message);
    }
    rememberMissingCol(col);
    attempt = attempt.map((r) => stripCols(r, new Set([col])));
  }
  throw new Error("Goal save failed: too many unknown columns in the live schema.");
}

function goalToInsert(goal: Goal, userId: string): GoalInsert {
  // NOTE: localUpdatedAt is intentionally omitted — it's a local-only field used
  // by the merge-on-load strategy and has no DB column.
  //
  // NOTE: financialType is local-only (no DB column yet). It drives the Money
  // category goal editor UI and is persisted only via localStorage.
  const row: GoalInsert = {
    user_id: userId,
    client_id: goal.id,
    title: goal.title,
    category: goal.category ?? "Life",
    timeframe: goal.timeframe ?? "annual",
    quarter: goal.quarter ?? null,
    deadline: goal.deadline ?? null,
    target: goal.target ?? null,
    current_value: goal.current ?? null,
    unit: goal.unit ?? null,
    done: !!goal.done,
    note: goal.note ?? null,
    // sub_steps is jsonb in the DB; the Goal sub-step shape is JSON-safe at runtime
    // but TS can't prove that without an index signature, so cast through unknown.
    sub_steps: (goal.subSteps as unknown as GoalInsert["sub_steps"]) ?? null,
    plan_summary: goal.planSummary ?? null,
    plan_start_date: goal.planStartDate ?? null,
    tags: goal.tags ?? null,
    progress_log:
      (goal.progressLog as unknown as GoalInsert["progress_log"]) ?? null,
    last_check_in: goal.lastCheckIn ?? null,
  };
  // Streak / per-day-log columns — included only when the live schema has them.
  if (extendedColumnsAvailable()) {
    row.goal_type = goal.goalType ?? null;
    row.streak_start = goal.streakStart ?? null;
    row.daily_log = (goal.dailyLog as unknown as GoalInsert["daily_log"]) ?? null;
    row.relapse_log = (goal.relapseLog as unknown as GoalInsert["relapse_log"]) ?? null;
  }
  // Preserve seed createdAt only when meaningful; let DB default when 0.
  if (goal.createdAt && goal.createdAt > 0) {
    row.created_at = new Date(goal.createdAt).toISOString();
  }
  // Stamp updated_at with this goal's last *local* mutation time so cross-device
  // merge-on-load can tell which side is newer. We set it explicitly (rather than
  // relying on a DB trigger that may or may not exist) — matching how recurringRepo
  // and userStateRepo persist their timestamps. Falls back to "now" for goals that
  // were never stamped locally (e.g. seed goals on first push).
  row.updated_at = new Date(
    goal.localUpdatedAt && goal.localUpdatedAt > 0 ? goal.localUpdatedAt : Date.now(),
  ).toISOString();
  return row;
}

/** A goal loaded from the cloud, paired with the epoch-ms of its last update.
 *  The timestamp lets the caller reconcile against a local goal's `localUpdatedAt`. */
export interface LoadedGoal {
  goal: Goal;
  cloudUpdatedAt: number;
}

export async function loadGoalsWithMeta(userId: string): Promise<LoadedGoal[]> {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const row = r as unknown as GoalRow;
    return {
      goal: rowToGoal(row),
      cloudUpdatedAt: row.updated_at ? new Date(row.updated_at).getTime() : 0,
    };
  });
}

export async function loadGoals(userId: string): Promise<Goal[]> {
  return (await loadGoalsWithMeta(userId)).map((l) => l.goal);
}

export async function bulkUpsertGoals(
  userId: string,
  goals: Goal[],
): Promise<void> {
  if (goals.length === 0) return;
  await upsertGoalRows(goals.map((g) => goalToInsert(g, userId)));
}

export async function upsertGoal(userId: string, goal: Goal): Promise<void> {
  await upsertGoalRows([goalToInsert(goal, userId)]);
}

export async function deleteGoalByClientId(
  userId: string,
  clientId: string,
): Promise<void> {
  const { error } = await supabase
    .from("goals")
    .delete()
    .eq("user_id", userId)
    .eq("client_id", clientId);
  if (error) throw new Error(error.message);
}
