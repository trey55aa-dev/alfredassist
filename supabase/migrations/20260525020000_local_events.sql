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
