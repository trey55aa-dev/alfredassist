// Thin wrapper around the notion-proxy edge function.
// Token never touches client-side code — it stays in user_state on the server.

import { supabase } from "@/integrations/supabase/client";

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notion-proxy`;

async function call<T>(action: string, payload?: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");

  const res = await fetch(EDGE_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...payload }),
  });

  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}

export interface NotionDb  { id: string; title: string; url: string }
export interface NotionPage { id: string; title: string; url: string }
export interface NotionTask { id: string; text: string; done: boolean }

export const notion = {
  connect:       (token: string) =>
    call<{ connected: boolean; workspace: string }>("connect", { token }),

  status:        () =>
    call<{ connected: boolean; workspace: string | null }>("status"),

  listDatabases: () =>
    call<NotionDb[]>("list-databases"),

  listPages:     () =>
    call<NotionPage[]>("list-pages"),

  pushGoals: (goals: unknown[], databaseId: string) =>
    call<{ pushed: Array<{ id: string; notionId?: string; error?: string }> }>(
      "push-goals", { goals, databaseId },
    ),

  pushBrainDump: (items: string[], pageId: string) =>
    call<{ pushed: number }>("push-braindump", { items, pageId }),

  pullTasks: (databaseId: string) =>
    call<NotionTask[]>("pull-tasks", { databaseId }),

  disconnect: () =>
    call<{ ok: boolean }>("disconnect"),
};
