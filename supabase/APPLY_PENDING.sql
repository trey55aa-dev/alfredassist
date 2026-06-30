-- ============================================================
-- APPLY_PENDING.sql — run in the Supabase SQL Editor for the
-- LIVE project (zsmnhphdagevtdooqpqp) to create the tables/columns
-- cross-device sync needs. Every statement is idempotent (safe to
-- re-run). Assumes the initial profiles/goals migration is already
-- applied; if the diagnostic shows no 'goals' table, use the CLI route.
-- ============================================================

-- ---- 20260524000000_goals_progress_log.sql ----
-- Daily progress logging on goals: per-day snapshots and last-check-in stamp.
-- Both fields are nullable so existing rows stay valid.
alter table public.goals
  add column if not exists progress_log jsonb,
  add column if not exists last_check_in date;

-- ---- 20260525000000_habits.sql ----
-- Habits + per-day habit logs, both per-user with RLS.
-- Mirrors the goals migration: client_id stays the stable id used in the UI,
-- (user_id, client_id) is unique so upserts work on rapid edits.

create table if not exists public.habits (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  client_id      text not null,
  title          text not null,
  cadence        text not null default 'daily',
  goal_id        text,
  goal_increment integer,
  target         integer,
  recovery_steps text[],
  archived       boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, client_id)
);

alter table public.habits enable row level security;

drop policy if exists "habits_select_own"  on public.habits;
drop policy if exists "habits_insert_own"  on public.habits;
drop policy if exists "habits_update_own"  on public.habits;
drop policy if exists "habits_delete_own"  on public.habits;

create policy "habits_select_own"  on public.habits for select using (auth.uid() = user_id);
create policy "habits_insert_own"  on public.habits for insert with check (auth.uid() = user_id);
create policy "habits_update_own"  on public.habits for update using (auth.uid() = user_id);
create policy "habits_delete_own"  on public.habits for delete using (auth.uid() = user_id);

drop trigger if exists habits_update_updated_at on public.habits;
create trigger habits_update_updated_at
  before update on public.habits
  for each row execute function public.update_updated_at_column();

create index if not exists habits_user_id_idx on public.habits(user_id);

-- One row per (user, habit, day). Inserts = "did it today", deletes = "untick".
create table if not exists public.habit_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  habit_client_id text not null,
  log_date        date not null,
  created_at      timestamptz not null default now(),
  unique (user_id, habit_client_id, log_date)
);

alter table public.habit_logs enable row level security;

drop policy if exists "habit_logs_select_own"  on public.habit_logs;
drop policy if exists "habit_logs_insert_own"  on public.habit_logs;
drop policy if exists "habit_logs_delete_own"  on public.habit_logs;

create policy "habit_logs_select_own"  on public.habit_logs for select using (auth.uid() = user_id);
create policy "habit_logs_insert_own"  on public.habit_logs for insert with check (auth.uid() = user_id);
create policy "habit_logs_delete_own"  on public.habit_logs for delete using (auth.uid() = user_id);

create index if not exists habit_logs_user_idx on public.habit_logs(user_id, log_date);
create index if not exists habit_logs_habit_idx on public.habit_logs(user_id, habit_client_id);

-- ---- 20260525010000_custom_lists.sql ----
-- Custom lists: user-defined checklists with a header (title/emoji/color)
-- and an ordered jsonb array of items. RLS per-user. client_id stays the
-- stable id used in the UI.

create table if not exists public.custom_lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  client_id  text not null,
  title      text not null,
  emoji      text,
  color      text,
  items      jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

alter table public.custom_lists enable row level security;

drop policy if exists "custom_lists_select_own" on public.custom_lists;
drop policy if exists "custom_lists_insert_own" on public.custom_lists;
drop policy if exists "custom_lists_update_own" on public.custom_lists;
drop policy if exists "custom_lists_delete_own" on public.custom_lists;

create policy "custom_lists_select_own" on public.custom_lists for select using (auth.uid() = user_id);
create policy "custom_lists_insert_own" on public.custom_lists for insert with check (auth.uid() = user_id);
create policy "custom_lists_update_own" on public.custom_lists for update using (auth.uid() = user_id);
create policy "custom_lists_delete_own" on public.custom_lists for delete using (auth.uid() = user_id);

drop trigger if exists custom_lists_update_updated_at on public.custom_lists;
create trigger custom_lists_update_updated_at
  before update on public.custom_lists
  for each row execute function public.update_updated_at_column();

create index if not exists custom_lists_user_idx on public.custom_lists(user_id);

-- ---- 20260525020000_local_events.sql ----
-- Manually-created agenda events ("Quick Add"). Google/Outlook events are NOT
-- stored here — they live in their own providers. RLS per-user. client_id is
-- the AgendaEvent.id used throughout the UI.

create table if not exists public.local_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  client_id       text not null,
  title           text not null,
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  all_day         boolean not null default false,
  location        text,
  description     text,
  calendar_name   text,
  calendar_color  text,
  emoji           text,
  completed       boolean not null default false,
  original_date   text,
  carry_count     integer,
  estimated_minutes integer,
  actual_minutes  integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, client_id)
);

alter table public.local_events enable row level security;

drop policy if exists "local_events_select_own" on public.local_events;
drop policy if exists "local_events_insert_own" on public.local_events;
drop policy if exists "local_events_update_own" on public.local_events;
drop policy if exists "local_events_delete_own" on public.local_events;

create policy "local_events_select_own" on public.local_events for select using (auth.uid() = user_id);
create policy "local_events_insert_own" on public.local_events for insert with check (auth.uid() = user_id);
create policy "local_events_update_own" on public.local_events for update using (auth.uid() = user_id);
create policy "local_events_delete_own" on public.local_events for delete using (auth.uid() = user_id);

drop trigger if exists local_events_update_updated_at on public.local_events;
create trigger local_events_update_updated_at
  before update on public.local_events
  for each row execute function public.update_updated_at_column();

create index if not exists local_events_user_idx on public.local_events(user_id);

-- ---- 20260620000000_goals_streak_columns.sql ----
-- Streak-goal support on goals: type, streak start date, per-day log, relapse log.
-- All nullable so existing rows stay valid. The client (goalsRepo) also degrades
-- gracefully and strips these columns if this migration hasn't been applied yet.
alter table public.goals
  add column if not exists goal_type    text,
  add column if not exists streak_start date,
  add column if not exists daily_log    jsonb,
  add column if not exists relapse_log  jsonb;

-- ---- 20260620010000_recurring.sql ----
-- Recurring schedule templates + per-day completions, per-user with RLS.
-- Mirrors goals/habits: client_id is the stable id used in the UI, and
-- (user_id, client_id) is unique so upserts work on rapid edits.
-- Shapes match src/lib/recurringRepo.ts.

create table if not exists public.recurring_templates (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  client_id     text not null,
  title         text not null,
  emoji         text,
  color         text,
  start_time    text not null,
  end_time      text not null,
  recurrence    text not null default 'daily',
  days          integer[] not null default '{}',
  enabled       boolean not null default true,
  routine_group text,
  goal_id       text,
  goal_value    numeric,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, client_id)
);

alter table public.recurring_templates enable row level security;

drop policy if exists "recurring_templates_select_own" on public.recurring_templates;
drop policy if exists "recurring_templates_insert_own" on public.recurring_templates;
drop policy if exists "recurring_templates_update_own" on public.recurring_templates;
drop policy if exists "recurring_templates_delete_own" on public.recurring_templates;

create policy "recurring_templates_select_own" on public.recurring_templates for select using (auth.uid() = user_id);
create policy "recurring_templates_insert_own" on public.recurring_templates for insert with check (auth.uid() = user_id);
create policy "recurring_templates_update_own" on public.recurring_templates for update using (auth.uid() = user_id);
create policy "recurring_templates_delete_own" on public.recurring_templates for delete using (auth.uid() = user_id);

drop trigger if exists recurring_templates_update_updated_at on public.recurring_templates;
create trigger recurring_templates_update_updated_at
  before update on public.recurring_templates
  for each row execute function public.update_updated_at_column();

create index if not exists recurring_templates_user_idx on public.recurring_templates(user_id);

-- One row per (user, template, day). completed / skipped flags per day.
create table if not exists public.recurring_completions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  template_id  text not null,
  date_str     date not null,
  completed    boolean not null default false,
  skipped      boolean not null default false,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (user_id, template_id, date_str)
);

alter table public.recurring_completions enable row level security;

drop policy if exists "recurring_completions_select_own" on public.recurring_completions;
drop policy if exists "recurring_completions_insert_own" on public.recurring_completions;
drop policy if exists "recurring_completions_update_own" on public.recurring_completions;
drop policy if exists "recurring_completions_delete_own" on public.recurring_completions;

create policy "recurring_completions_select_own" on public.recurring_completions for select using (auth.uid() = user_id);
create policy "recurring_completions_insert_own" on public.recurring_completions for insert with check (auth.uid() = user_id);
create policy "recurring_completions_update_own" on public.recurring_completions for update using (auth.uid() = user_id);
create policy "recurring_completions_delete_own" on public.recurring_completions for delete using (auth.uid() = user_id);

create index if not exists recurring_completions_user_date_idx on public.recurring_completions(user_id, date_str);

-- ---- 20260620020000_user_state.sql ----
-- Generic per-user key/value store for app state that was previously local-only:
-- gamification (XP/level/badges), streak, journal, brain dump, focus stats,
-- timer history, and the weekly planner. One row per (user, key); `value` is an
-- opaque JSON blob owned by the client.
--
-- NOTE: there is intentionally no updated_at trigger. The client sets updated_at
-- explicitly on every write so it can do last-write-wins reconciliation across
-- devices; an auto-trigger would clobber that timestamp.
create table if not exists public.user_state (
  user_id    uuid not null references auth.users(id) on delete cascade,
  key        text not null,
  value      jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_state enable row level security;

drop policy if exists "user_state_select_own" on public.user_state;
drop policy if exists "user_state_insert_own" on public.user_state;
drop policy if exists "user_state_update_own" on public.user_state;
drop policy if exists "user_state_delete_own" on public.user_state;

create policy "user_state_select_own" on public.user_state for select using (auth.uid() = user_id);
create policy "user_state_insert_own" on public.user_state for insert with check (auth.uid() = user_id);
create policy "user_state_update_own" on public.user_state for update using (auth.uid() = user_id);
create policy "user_state_delete_own" on public.user_state for delete using (auth.uid() = user_id);

