// Supabase-backed storage for habits + habit logs.
// The Habit + HabitLog client types stay unchanged; this layer maps to/from
// snake_case rows. Habit.id is stored as client_id so seed ids ("h-d1", "h-w1"...)
// keep working across cloud + local cache.

import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import type { Habit, HabitLog } from "./habits";
import { normalizeCadence } from "./habits";

type HabitInsert = TablesInsert<"habits">;
type HabitLogInsert = TablesInsert<"habit_logs">;

interface HabitRow {
  id: string;
  user_id: string;
  client_id: string;
  title: string;
  cadence: string;
  goal_id: string | null;
  goal_increment: number | null;
  target: number | null;
  recovery_steps: string[] | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

interface HabitLogRow {
  id: string;
  user_id: string;
  habit_client_id: string;
  log_date: string;
  created_at: string;
}

/* ---------- mapping ---------- */

function rowToHabit(row: HabitRow): Habit {
  return {
    id: row.client_id,
    title: row.title,
    cadence: normalizeCadence(row.cadence),
    goalId: row.goal_id ?? undefined,
    goalIncrement: row.goal_increment ?? undefined,
    target: row.target ?? undefined,
    recoverySteps: row.recovery_steps ?? undefined,
    archived: row.archived,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

function habitToInsert(habit: Habit, userId: string): HabitInsert {
  const row: HabitInsert = {
    user_id: userId,
    client_id: habit.id,
    title: habit.title,
    cadence: habit.cadence ?? "daily",
    goal_id: habit.goalId ?? null,
    goal_increment: habit.goalIncrement ?? null,
    target: habit.target ?? null,
    recovery_steps: habit.recoverySteps ?? null,
    archived: !!habit.archived,
  };
  // Preserve seed createdAt only when meaningful; let DB default when 0.
  if (habit.createdAt && habit.createdAt > 0) {
    row.created_at = new Date(habit.createdAt).toISOString();
  }
  return row;
}

function rowToHabitLog(row: HabitLogRow): HabitLog {
  // log_date comes back as YYYY-MM-DD (postgres date), which is exactly what
  // HabitLog wants. No timezone conversion.
  return { habitId: row.habit_client_id, date: row.log_date };
}

function logToInsert(log: HabitLog, userId: string): HabitLogInsert {
  return {
    user_id: userId,
    habit_client_id: log.habitId,
    log_date: log.date,
  };
}

/* ---------- habits CRUD ---------- */

export async function loadHabits(userId: string): Promise<Habit[]> {
  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToHabit(r as unknown as HabitRow));
}

export async function bulkUpsertHabits(
  userId: string,
  habits: Habit[],
): Promise<void> {
  if (habits.length === 0) return;
  const rows = habits.map((h) => habitToInsert(h, userId));
  const { error } = await supabase
    .from("habits")
    .upsert(rows, { onConflict: "user_id,client_id" });
  if (error) throw new Error(error.message);
}

export async function upsertHabit(userId: string, habit: Habit): Promise<void> {
  const { error } = await supabase
    .from("habits")
    .upsert(habitToInsert(habit, userId), { onConflict: "user_id,client_id" });
  if (error) throw new Error(error.message);
}

export async function deleteHabitByClientId(
  userId: string,
  clientId: string,
): Promise<void> {
  // Drop the habit's logs first since RLS handles per-user scope (no FK to clean up).
  await supabase
    .from("habit_logs")
    .delete()
    .eq("user_id", userId)
    .eq("habit_client_id", clientId);
  const { error } = await supabase
    .from("habits")
    .delete()
    .eq("user_id", userId)
    .eq("client_id", clientId);
  if (error) throw new Error(error.message);
}

/* ---------- habit logs CRUD ---------- */

export async function loadHabitLogs(userId: string): Promise<HabitLog[]> {
  const { data, error } = await supabase
    .from("habit_logs")
    .select("*")
    .eq("user_id", userId)
    .order("log_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToHabitLog(r as unknown as HabitLogRow));
}

export async function bulkUpsertHabitLogs(
  userId: string,
  logs: HabitLog[],
): Promise<void> {
  if (logs.length === 0) return;
  const rows = logs.map((l) => logToInsert(l, userId));
  // upsert with onConflict so re-ticking the same day is a no-op.
  const { error } = await supabase
    .from("habit_logs")
    .upsert(rows, { onConflict: "user_id,habit_client_id,log_date" });
  if (error) throw new Error(error.message);
}

export async function addHabitLog(
  userId: string,
  log: HabitLog,
): Promise<void> {
  const { error } = await supabase
    .from("habit_logs")
    .upsert(logToInsert(log, userId), {
      onConflict: "user_id,habit_client_id,log_date",
    });
  if (error) throw new Error(error.message);
}

export async function removeHabitLog(
  userId: string,
  log: HabitLog,
): Promise<void> {
  const { error } = await supabase
    .from("habit_logs")
    .delete()
    .eq("user_id", userId)
    .eq("habit_client_id", log.habitId)
    .eq("log_date", log.date);
  if (error) throw new Error(error.message);
}
