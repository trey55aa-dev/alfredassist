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
