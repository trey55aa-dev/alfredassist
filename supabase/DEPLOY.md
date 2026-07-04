# Alfred — go-live checklist

Everything below needs your Supabase account (I can't authenticate). Do it once
and the AI + push features light up. Project ref: **zsmnhphdagevtdooqpqp**.

Prereq: `supabase login` (opens a browser), then from the repo root:
`supabase link --project-ref zsmnhphdagevtdooqpqp`

---

## 1. Database

Apply the push table migration (SQL Editor → paste, or CLI):

```bash
supabase db push          # applies any un-applied migrations, incl. push_subscriptions
```
Or paste `supabase/migrations/20260703000000_push_subscriptions.sql` into the SQL Editor.
(If you haven't already run `supabase/APPLY_PENDING.sql`, do that too.)

---

## 2. Secrets

```bash
# AI — rotate the exposed key first (Google AI Studio), then:
supabase secrets set GEMINI_API_KEY=<your-new-rotated-key>

# Web push VAPID (reads from the gitignored keyfile — nothing is printed):
supabase secrets set \
  VAPID_PUBLIC_KEY=$(jq -r .publicKey supabase/vapid-keys.local.json) \
  VAPID_PRIVATE_KEY=$(jq -r .privateKey supabase/vapid-keys.local.json)

# Cron auth for send-briefings — generate one and KEEP it (used in step 4):
supabase secrets set CRON_SECRET=$(openssl rand -hex 32)
supabase secrets list | grep CRON_SECRET   # note the value for step 4
```

## 3. Deploy the edge functions

```bash
supabase functions deploy alfred-chat      --project-ref zsmnhphdagevtdooqpqp
supabase functions deploy breakdown-goal   --project-ref zsmnhphdagevtdooqpqp
supabase functions deploy send-briefings   --project-ref zsmnhphdagevtdooqpqp
# (notion-proxy too, if you use the Notion sync)
```

Quick smoke test of Alfred's chat:
```bash
curl -s -X POST https://zsmnhphdagevtdooqpqp.supabase.co/functions/v1/alfred-chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Say hello, Alfred.","history":[],"context":""}'
# → {"reply":"Good day, sir. ..."}
```

## 4. Schedule the hourly briefing (SQL Editor)

Replace `PUT_YOUR_CRON_SECRET_HERE` with the value from step 2:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'alfred-briefings-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://zsmnhphdagevtdooqpqp.supabase.co/functions/v1/send-briefings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'PUT_YOUR_CRON_SECRET_HERE'
    ),
    body := '{}'::jsonb
  );
  $$
);
-- To change/remove later: select cron.unschedule('alfred-briefings-hourly');
```

The function runs every hour and only pushes to users whose LOCAL time is 7am
(morning) or 7pm (evening), once per briefing per day.

---

## 5. Turn it on (in the app)

Open the app on your phone/computer → **Agenda → "Enable briefings"** → allow
notifications. That saves your device to `push_subscriptions`. You'll get the
next briefing at your local 7am/7pm.

To test immediately without waiting, hit the function manually (it still respects
the 7am/7pm window, so temporarily change MORNING_HOUR/EVENING_HOUR in the
function to the current hour, deploy, trigger, then revert):
```bash
curl -s -X POST https://zsmnhphdagevtdooqpqp.supabase.co/functions/v1/send-briefings \
  -H "x-cron-secret: <your CRON_SECRET>"
```

## Notes
- iOS: web push works only for apps **added to the Home Screen** (PWA), iOS 16.4+.
- `supabase/vapid-keys.local.json` is gitignored — keep it; it's your only copy of
  the private key. If you lose it, generate a new pair and re-set the secrets
  (existing subscriptions keep working only if the public key is unchanged).
