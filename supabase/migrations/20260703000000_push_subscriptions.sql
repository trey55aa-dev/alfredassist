-- Web-push subscriptions: one row per device/browser a user has opted into.
-- The send-briefings edge function reads these (via service role, bypassing RLS)
-- to deliver morning/evening notifications; users manage their own rows via RLS.

create table if not exists public.push_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  -- The PushSubscription fields the Web Push protocol needs.
  endpoint         text not null unique,
  p256dh           text not null,
  auth             text not null,
  -- IANA timezone (e.g. "America/New_York") so the server can fire at the
  -- user's LOCAL 7am / 7pm rather than a fixed UTC hour.
  timezone         text,
  morning_enabled  boolean not null default true,
  evening_enabled  boolean not null default true,
  -- De-dupe guards so a given briefing is sent at most once per local day.
  last_sent_morning date,
  last_sent_evening date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subs_select_own" on public.push_subscriptions;
drop policy if exists "push_subs_insert_own" on public.push_subscriptions;
drop policy if exists "push_subs_update_own" on public.push_subscriptions;
drop policy if exists "push_subs_delete_own" on public.push_subscriptions;

create policy "push_subs_select_own" on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "push_subs_insert_own" on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "push_subs_update_own" on public.push_subscriptions for update using (auth.uid() = user_id);
create policy "push_subs_delete_own" on public.push_subscriptions for delete using (auth.uid() = user_id);
