// Alfred ↔ Notion proxy edge function.
//
// All Notion API calls go through here so the user's integration token stays
// server-side (stored in user_state, never sent to the browser).
//
// Deploy: supabase functions deploy notion-proxy --project-ref zsmnhphdagevtdooqpqp
//
// Actions:
//   connect         { token }            → verify token, save to user_state
//   status          {}                   → { connected, workspace }
//   list-databases  {}                   → [{ id, title }]
//   list-pages      {}                   → [{ id, title }]
//   push-goals      { goals, databaseId} → { pushed: [{id, notionId|error}] }
//   push-braindump  { items, pageId }    → { pushed: n }
//   pull-tasks      { databaseId }       → [{ id, text }]
//   disconnect      {}                   → { ok }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const JSON_HEADERS = { ...CORS, "Content-Type": "application/json" };
const NOTION_API = "https://api.notion.com/v1";
const NOTION_VER = "2022-06-28";
const STATE_KEY  = "alfred.notion.config";

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}
function err(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), { status, headers: JSON_HEADERS });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return err("Missing authorization", 401);

    // Authenticated client (user's JWT) for verifying identity
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return err("Unauthorized", 401);

    // Service-role client for reading/writing user_state
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { action } = body as { action: string; [k: string]: unknown };

    // ── Helper: get stored token and make a Notion API call ──────────
    const notion = async (path: string, method = "GET", payload?: unknown) => {
      const { data } = await svc
        .from("user_state")
        .select("value")
        .eq("user_id", user.id)
        .eq("key", STATE_KEY)
        .single();
      const token = (data?.value as Record<string, unknown>)?.token as string | undefined;
      if (!token) throw new Error("Notion not connected");

      const res = await fetch(`${NOTION_API}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Notion-Version": NOTION_VER,
        },
        body: payload !== undefined ? JSON.stringify(payload) : undefined,
      });
      const json = await res.json();
      if (!res.ok) throw new Error((json as { message?: string }).message ?? `Notion ${res.status}`);
      return json;
    };

    // ── connect ───────────────────────────────────────────────────────
    if (action === "connect") {
      const { token } = body as { token: string };
      const res = await fetch(`${NOTION_API}/users/me`, {
        headers: { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_VER },
      });
      if (!res.ok) return err("Invalid Notion integration token");
      const me = await res.json() as { name?: string; bot?: { workspace_name?: string } };
      const workspace = me.bot?.workspace_name ?? me.name ?? "Notion Workspace";

      await svc.from("user_state").upsert(
        { user_id: user.id, key: STATE_KEY, value: { token, workspace, connectedAt: Date.now() }, updated_at: Date.now() },
        { onConflict: "user_id,key" },
      );
      return ok({ connected: true, workspace });
    }

    // ── status ────────────────────────────────────────────────────────
    if (action === "status") {
      const { data } = await svc
        .from("user_state")
        .select("value")
        .eq("user_id", user.id)
        .eq("key", STATE_KEY)
        .single();
      const val = data?.value as Record<string, unknown> | null;
      return ok({ connected: !!val?.token, workspace: val?.workspace ?? null });
    }

    // ── list-databases ────────────────────────────────────────────────
    if (action === "list-databases") {
      const search = await notion("/search", "POST", {
        filter: { value: "database", property: "object" },
        sort: { direction: "descending", timestamp: "last_edited_time" },
        page_size: 30,
      }) as { results: unknown[] };
      return ok(
        (search.results ?? []).map((db: unknown) => {
          const d = db as Record<string, unknown>;
          const titleArr = (d.title as Array<{ plain_text: string }> | undefined) ?? [];
          return { id: d.id, title: titleArr[0]?.plain_text ?? "Untitled", url: d.url };
        }),
      );
    }

    // ── list-pages ────────────────────────────────────────────────────
    if (action === "list-pages") {
      const search = await notion("/search", "POST", {
        filter: { value: "page", property: "object" },
        sort: { direction: "descending", timestamp: "last_edited_time" },
        page_size: 30,
      }) as { results: unknown[] };
      return ok(
        (search.results ?? []).map((pg: unknown) => {
          const p = pg as Record<string, unknown>;
          const props = p.properties as Record<string, unknown> | undefined;
          const titleArr =
            (props?.title as { title: Array<{ plain_text: string }> } | undefined)?.title ??
            (p.title as Array<{ plain_text: string }> | undefined) ?? [];
          return { id: p.id, title: titleArr[0]?.plain_text ?? "Untitled", url: p.url };
        }),
      );
    }

    // ── push-goals ────────────────────────────────────────────────────
    if (action === "push-goals") {
      const { goals, databaseId } = body as {
        goals: Array<{ id: string; title: string; category?: string; pct?: number; deadline?: string; done?: boolean }>;
        databaseId: string;
      };
      const results: Array<{ id: string; notionId?: string; error?: string }> = [];
      for (const g of goals) {
        try {
          const page = await notion("/pages", "POST", {
            parent: { database_id: databaseId },
            properties: {
              "Name":     { title: [{ text: { content: g.title } }] },
              "Category": { rich_text: [{ text: { content: g.category ?? "" } }] },
              "Progress": { number: g.pct ?? 0 },
              ...(g.deadline ? { "Deadline": { date: { start: g.deadline } } } : {}),
            },
          }) as { id: string };
          results.push({ id: g.id, notionId: page.id });
        } catch (e: unknown) {
          results.push({ id: g.id, error: e instanceof Error ? e.message : String(e) });
        }
      }
      return ok({ pushed: results });
    }

    // ── push-braindump ────────────────────────────────────────────────
    if (action === "push-braindump") {
      const { items, pageId } = body as { items: string[]; pageId: string };
      const blocks = items.map((text) => ({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: [{ type: "text", text: { content: text.slice(0, 2000) } }] },
      }));
      await notion(`/blocks/${pageId}/children`, "PATCH", { children: blocks });
      return ok({ pushed: items.length });
    }

    // ── pull-tasks ────────────────────────────────────────────────────
    if (action === "pull-tasks") {
      const { databaseId } = body as { databaseId: string };
      const db = await notion(`/databases/${databaseId}/query`, "POST", { page_size: 100 }) as { results: unknown[] };
      const tasks = (db.results ?? []).map((pg: unknown) => {
        const p = pg as Record<string, unknown>;
        const props = p.properties as Record<string, unknown>;
        const nameArr = (props?.Name as { title: Array<{ plain_text: string }> } | undefined)?.title ?? [];
        return { id: p.id as string, text: nameArr[0]?.plain_text ?? "Untitled", done: false };
      });
      return ok(tasks);
    }

    // ── disconnect ────────────────────────────────────────────────────
    if (action === "disconnect") {
      await svc.from("user_state").delete().eq("user_id", user.id).eq("key", STATE_KEY);
      return ok({ ok: true });
    }

    return err(`Unknown action: ${action}`);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
});
