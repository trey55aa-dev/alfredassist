// Supabase-backed storage for custom lists. items array stays inline in a
// single jsonb column — small lists, low write rate, simpler than a join table.

import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import type { CustomList, CustomListItem } from "./customLists";

type CustomListInsert = TablesInsert<"custom_lists">;

interface CustomListRow {
  id: string;
  user_id: string;
  client_id: string;
  title: string;
  emoji: string | null;
  color: string | null;
  items: CustomListItem[] | null;
  created_at: string;
  updated_at: string;
}

function rowToList(row: CustomListRow): CustomList {
  return {
    id: row.client_id,
    title: row.title,
    emoji: row.emoji ?? undefined,
    color: row.color ?? undefined,
    items: Array.isArray(row.items) ? row.items : [],
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

function listToInsert(list: CustomList, userId: string): CustomListInsert {
  const row: CustomListInsert = {
    user_id: userId,
    client_id: list.id,
    title: list.title,
    emoji: list.emoji ?? null,
    color: list.color ?? null,
    items: (list.items ?? []) as unknown as CustomListInsert["items"],
  };
  if (list.createdAt && list.createdAt > 0) {
    row.created_at = new Date(list.createdAt).toISOString();
  }
  return row;
}

export async function loadCustomLists(userId: string): Promise<CustomList[]> {
  const { data, error } = await supabase
    .from("custom_lists")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToList(r as unknown as CustomListRow));
}

export async function bulkUpsertCustomLists(
  userId: string,
  lists: CustomList[],
): Promise<void> {
  if (lists.length === 0) return;
  const rows = lists.map((l) => listToInsert(l, userId));
  const { error } = await supabase
    .from("custom_lists")
    .upsert(rows, { onConflict: "user_id,client_id" });
  if (error) throw new Error(error.message);
}

export async function upsertCustomList(
  userId: string,
  list: CustomList,
): Promise<void> {
  const { error } = await supabase
    .from("custom_lists")
    .upsert(listToInsert(list, userId), { onConflict: "user_id,client_id" });
  if (error) throw new Error(error.message);
}

export async function deleteCustomListByClientId(
  userId: string,
  clientId: string,
): Promise<void> {
  const { error } = await supabase
    .from("custom_lists")
    .delete()
    .eq("user_id", userId)
    .eq("client_id", clientId);
  if (error) throw new Error(error.message);
}
