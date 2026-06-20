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
