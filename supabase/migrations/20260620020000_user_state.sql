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
