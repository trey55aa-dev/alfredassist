// Supabase storage for manually-created agenda events. Used by agendaStore's
// write-through layer. Google/Outlook events never touch this table.

import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import type { AgendaEvent } from "./agenda";

type LocalEventInsert = TablesInsert<"local_events">;

interface LocalEventRow {
  id: string;
  user_id: string;
  client_id: string;
  title: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  location: string | null;
  description: string | null;
  calendar_name: string | null;
  calendar_color: string | null;
  emoji: string | null;
  completed: boolean;
  original_date: string | null;
  carry_count: number | null;
  estimated_minutes: number | null;
  actual_minutes: number | null;
}

export function rowToEvent(row: LocalEventRow): AgendaEvent {
  return {
    id: row.client_id,
    title: row.title,
    start: row.start_at,
    end: row.end_at,
    allDay: row.all_day,
    location: row.location ?? undefined,
    description: row.description ?? undefined,
    source: "manual",
    calendarName: row.calendar_name ?? undefined,
    calendarColor: row.calendar_color ?? undefined,
    emoji: row.emoji ?? undefined,
    completed: row.completed,
    originalDate: row.original_date ?? undefined,
    carryCount: row.carry_count ?? undefined,
    estimatedMinutes: row.estimated_minutes ?? undefined,
    actualMinutes: row.actual_minutes ?? undefined,
  };
}

function eventToInsert(e: AgendaEvent, userId: string): LocalEventInsert {
  return {
    user_id: userId,
    client_id: e.id,
    title: e.title,
    start_at: e.start,
    end_at: e.end,
    all_day: !!e.allDay,
    location: e.location ?? null,
    description: e.description ?? null,
    calendar_name: e.calendarName ?? null,
    calendar_color: e.calendarColor ?? null,
    emoji: e.emoji ?? null,
    completed: !!e.completed,
    original_date: e.originalDate ?? null,
    carry_count: e.carryCount ?? null,
    estimated_minutes: e.estimatedMinutes ?? null,
    actual_minutes: e.actualMinutes ?? null,
  };
}

export async function loadLocalEventsCloud(userId: string): Promise<AgendaEvent[]> {
  const { data, error } = await supabase
    .from("local_events")
    .select("*")
    .eq("user_id", userId)
    .order("start_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToEvent(r as unknown as LocalEventRow));
}

export async function bulkUpsertLocalEvents(
  userId: string,
  events: AgendaEvent[],
): Promise<void> {
  const manual = events.filter((e) => e.source === "manual");
  if (manual.length === 0) return;
  const rows = manual.map((e) => eventToInsert(e, userId));
  const { error } = await supabase
    .from("local_events")
    .upsert(rows, { onConflict: "user_id,client_id" });
  if (error) throw new Error(error.message);
}

export async function upsertLocalEventCloud(
  userId: string,
  e: AgendaEvent,
): Promise<void> {
  const { error } = await supabase
    .from("local_events")
    .upsert(eventToInsert(e, userId), { onConflict: "user_id,client_id" });
  if (error) throw new Error(error.message);
}

export async function deleteLocalEventCloud(
  userId: string,
  clientId: string,
): Promise<void> {
  const { error } = await supabase
    .from("local_events")
    .delete()
    .eq("user_id", userId)
    .eq("client_id", clientId);
  if (error) throw new Error(error.message);
}
