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

function goalToInsert(goal: Goal, userId: string): GoalInsert {
  // NOTE: goal_type, streak_start, daily_log, relapse_log are intentionally
  // omitted here. Those columns don't yet exist in the live Supabase schema
  // (they're in the pending migration). Including unknown column names causes
  // PostgREST to reject the *entire* upsert with a 400, which silently breaks
  // all goal saves. Once the migration is run and the Supabase types are
  // regenerated, add them back.
  //
  // NOTE: localUpdatedAt is also intentionally omitted — it's a local-only
  // field used by the merge-on-load strategy and has no DB column.
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
  // Preserve seed createdAt only when meaningful; let DB default when 0.
  if (goal.createdAt && goal.createdAt > 0) {
    row.created_at = new Date(goal.createdAt).toISOString();
  }
  return row;
}

export async function loadGoals(userId: string): Promise<Goal[]> {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToGoal(r as unknown as GoalRow));
}

export async function bulkUpsertGoals(
  userId: string,
  goals: Goal[],
): Promise<void> {
  if (goals.length === 0) return;
  const rows = goals.map((g) => goalToInsert(g, userId));
  const { error } = await supabase
    .from("goals")
    .upsert(rows, { onConflict: "user_id,client_id" });
  if (error) throw new Error(error.message);
}

export async function upsertGoal(userId: string, goal: Goal): Promise<void> {
  const { error } = await supabase
    .from("goals")
    .upsert(goalToInsert(goal, userId), { onConflict: "user_id,client_id" });
  if (error) throw new Error(error.message);
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
