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
