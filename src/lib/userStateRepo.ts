// Generic per-user key/value cloud store for app state that is otherwise
// local-only. Backed by public.user_state (see 20260620020000_user_state.sql).
//
// Every function degrades gracefully: if the table doesn't exist yet (migration
// not applied), reads return [] and writes throw an error the caller swallows —
// so the app keeps working local-only until the migration lands.

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface UserStateRow {
  key: string;
  value: Json | null;
  /** epoch ms */
  updatedAt: number;
}

/** Fetch all key/value rows for this user. Returns [] on any error. */
export async function pullUserState(userId: string): Promise<UserStateRow[]> {
  const { data, error } = await supabase
    .from("user_state")
    .select("key, value, updated_at")
    .eq("user_id", userId);
  if (error || !Array.isArray(data)) return [];
  return data.map((r) => ({
    key: r.key as string,
    value: (r.value ?? null) as Json | null,
    updatedAt: r.updated_at ? Date.parse(r.updated_at as string) : 0,
  }));
}

/** Upsert one key. updatedAtMs is stored verbatim so the client can do
 *  last-write-wins reconciliation across devices. */
export async function upsertUserState(
  userId: string,
  key: string,
  value: Json,
  updatedAtMs: number,
): Promise<void> {
  const { error } = await supabase.from("user_state").upsert(
    {
      user_id: userId,
      key,
      value,
      updated_at: new Date(updatedAtMs).toISOString(),
    },
    { onConflict: "user_id,key" },
  );
  if (error) throw new Error(error.message);
}
