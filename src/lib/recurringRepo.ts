// Supabase-backed storage for recurring templates + per-day completions.
// The tables are NOT in the generated types file, so we cast through `any`.
// Run the SQL migration in docs/recurring_migration.sql before using.

import { supabase } from "@/integrations/supabase/client";
import type { RecurringTemplate } from "./recurring";

/* ────────────────────────────────────────────────
   Templates
───────────────────────────────────────────────── */

function templateToRow(t: RecurringTemplate, userId: string): Record<string, unknown> {
  return {
    user_id: userId,
    client_id: t.id,
    title: t.title,
    emoji: t.emoji ?? null,
    color: t.color ?? null,
    start_time: t.startTime,
    end_time: t.endTime,
    recurrence: t.recurrence,
    days: t.days ?? [],
    enabled: t.enabled,
    routine_group: t.routineGroup ?? null,
    goal_id: t.goalId ?? null,
    goal_value: t.goalValue ?? null,
    updated_at: new Date().toISOString(),
  };
}

function rowToTemplate(row: Record<string, unknown>): RecurringTemplate {
  return {
    id: row.client_id as string,
    title: row.title as string,
    emoji: (row.emoji as string | null) ?? undefined,
    color: (row.color as string | null) ?? undefined,
    startTime: row.start_time as string,
    endTime: row.end_time as string,
    recurrence: row.recurrence as RecurringTemplate["recurrence"],
    days: (row.days as number[] | null) ?? undefined,
    enabled: row.enabled as boolean,
    routineGroup: (row.routine_group as string | null) ?? undefined,
    goalId: (row.goal_id as string | null) ?? undefined,
    goalValue: (row.goal_value as number | null) ?? undefined,
  };
}

/** Upsert one template to the cloud (fire-and-forget friendly). */
export async function pushTemplate(userId: string, t: RecurringTemplate): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("recurring_templates")
    .upsert(templateToRow(t, userId), { onConflict: "user_id,client_id" });
  if (error) throw new Error(error.message);
}

/** Delete one template from the cloud. */
export async function deleteCloudTemplate(userId: string, clientId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("recurring_templates")
    .delete()
    .eq("user_id", userId)
    .eq("client_id", clientId);
  if (error) throw new Error(error.message);
}

/** Fetch all templates for this user from the cloud. Returns [] on error. */
export async function pullTemplates(userId: string): Promise<RecurringTemplate[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("recurring_templates")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error || !Array.isArray(data)) return [];
  return data.map((r: Record<string, unknown>) => rowToTemplate(r));
}

/** Push all templates to cloud in one batch (used for first-time migration). */
export async function bulkPushTemplates(userId: string, templates: RecurringTemplate[]): Promise<void> {
  if (templates.length === 0) return;
  const rows = templates.map((t) => templateToRow(t, userId));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("recurring_templates")
    .upsert(rows, { onConflict: "user_id,client_id" });
  if (error) throw new Error(error.message);
}

/* ────────────────────────────────────────────────
   Per-day Completions
───────────────────────────────────────────────── */

/** Upsert one completion record (check or skip) to the cloud. */
export async function pushCompletion(
  userId: string,
  templateId: string,
  dateStr: string,
  completed: boolean,
  skipped: boolean,
  completedAt?: string,
): Promise<void> {
  const row = {
    user_id: userId,
    template_id: templateId,
    date_str: dateStr,
    completed,
    skipped,
    completed_at: completedAt ?? null,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("recurring_completions")
    .upsert(row, { onConflict: "user_id,template_id,date_str" });
  if (error) throw new Error(error.message);
}

export interface CompletionRecord {
  templateId: string;
  dateStr: string;
  completed: boolean;
  skipped: boolean;
}

/** Fetch all completion records for a given date from the cloud. */
export async function pullCompletions(
  userId: string,
  dateStr: string,
): Promise<CompletionRecord[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("recurring_completions")
    .select("template_id, date_str, completed, skipped")
    .eq("user_id", userId)
    .eq("date_str", dateStr);
  if (error || !Array.isArray(data)) return [];
  return data.map((r: Record<string, unknown>) => ({
    templateId: r.template_id as string,
    dateStr: r.date_str as string,
    completed: r.completed as boolean,
    skipped: r.skipped as boolean,
  }));
}
