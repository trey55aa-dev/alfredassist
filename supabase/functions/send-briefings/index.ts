// Sends Alfred's morning (7am) and evening (7pm) briefings as Web Push — so they
// arrive even when the app is closed. Meant to be invoked HOURLY by pg_cron; each
// run it finds subscriptions whose LOCAL time is 7am/7pm and hasn't been sent yet.
//
// Deploy: supabase functions deploy send-briefings --project-ref zsmnhphdagevtdooqpqp
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... CRON_SECRET=...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const MORNING_HOUR = 7;
const EVENING_HOUR = 19;

interface Sub {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  timezone: string | null;
  morning_enabled: boolean;
  evening_enabled: boolean;
  last_sent_morning: string | null;
  last_sent_evening: string | null;
}

/** Local hour (0–23) and YYYY-MM-DD date for an IANA timezone. */
function localParts(tz: string): { hour: number; date: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // some engines emit 24 for midnight
  return { hour, date: `${get("year")}-${get("month")}-${get("day")}` };
}

type Briefing = { title: string; body: string; url: string };

async function buildBriefing(
  svc: ReturnType<typeof createClient>,
  userId: string,
  type: "morning" | "evening",
  localDate: string,
): Promise<Briefing> {
  const [{ data: habits }, { data: logs }, { data: goals }] = await Promise.all([
    svc.from("habits").select("client_id,cadence,archived").eq("user_id", userId),
    svc.from("habit_logs").select("habit_client_id").eq("user_id", userId).eq("log_date", localDate),
    svc.from("goals").select("done").eq("user_id", userId),
  ]);
  const daily = (habits ?? []).filter((h: { cadence: string; archived: boolean }) => h.cadence === "daily" && !h.archived);
  const doneIds = new Set((logs ?? []).map((l: { habit_client_id: string }) => l.habit_client_id));
  const doneToday = daily.filter((h: { client_id: string }) => doneIds.has(h.client_id)).length;
  const remaining = daily.length - doneToday;
  const activeGoals = (goals ?? []).filter((g: { done: boolean }) => !g.done).length;

  if (type === "morning") {
    return {
      title: "☀️ Good morning, sir.",
      body: daily.length
        ? `${daily.length} habit${daily.length === 1 ? "" : "s"} and ${activeGoals} goal${activeGoals === 1 ? "" : "s"} await. Let's begin the day's protocol.`
        : `${activeGoals} goal${activeGoals === 1 ? "" : "s"} in your campaign. A fine day to make progress.`,
      url: "/",
    };
  }
  let body: string;
  if (daily.length === 0) body = "The day winds down. Rest well, sir.";
  else if (remaining <= 0) body = `All ${daily.length} habits complete. Today is conquered — the streak holds.`;
  else body = `You're ${remaining} habit${remaining === 1 ? "" : "s"} from holding the streak. A little time remains.`;
  return { title: "🌙 Evening review", body, url: "/checklist" };
}

async function sendPush(sub: Sub, briefing: Briefing): Promise<"ok" | "gone" | "error"> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(briefing),
    );
    return "ok";
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) return "gone"; // subscription expired
    console.error("push send failed:", code, (e as { body?: string }).body);
    return "error";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const pub = Deno.env.get("VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!pub || !priv) {
    return new Response(JSON.stringify({ error: "VAPID keys not configured" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
  webpush.setVapidDetails("mailto:alfred@alfredassist.app", pub, priv);

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: subs, error } = await svc.from("push_subscriptions").select("*");
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  let sent = 0, removed = 0, skipped = 0;
  for (const sub of (subs ?? []) as Sub[]) {
    const { hour, date } = localParts(sub.timezone || "UTC");
    const doMorning = hour === MORNING_HOUR && sub.morning_enabled && sub.last_sent_morning !== date;
    const doEvening = hour === EVENING_HOUR && sub.evening_enabled && sub.last_sent_evening !== date;
    if (!doMorning && !doEvening) { skipped++; continue; }

    const type = doMorning ? "morning" : "evening";
    const briefing = await buildBriefing(svc, sub.user_id, type, date);
    const result = await sendPush(sub, briefing);

    if (result === "gone") {
      await svc.from("push_subscriptions").delete().eq("id", sub.id);
      removed++;
    } else if (result === "ok") {
      await svc.from("push_subscriptions")
        .update(type === "morning" ? { last_sent_morning: date } : { last_sent_evening: date })
        .eq("id", sub.id);
      sent++;
    }
  }

  return new Response(JSON.stringify({ sent, removed, skipped, total: subs?.length ?? 0 }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
