-- Turn on Realtime for the tables that carry cross-device state.
--
-- Without this, a habit ticked on the phone reaches the server fine but the
-- laptop never hears about it — it only ever pulled at login. The client
-- subscribes to postgres_changes on these four tables (see src/lib/syncSignal.ts)
-- and re-pulls when a row it owns changes.
--
-- The app degrades gracefully if this migration hasn't been applied: the same
-- re-pull also runs on window focus, tab visibility and coming back online, so
-- sync falls back to "when you look at it" rather than breaking.
--
-- Idempotent — safe to re-run.

-- REPLICA IDENTITY FULL makes the old row available on UPDATE/DELETE events.
-- Without it Postgres only ships the primary key, and a delete would arrive
-- with no user_id for the client-side filter to match.
alter table public.goals       replica identity full;
alter table public.habits      replica identity full;
alter table public.habit_logs  replica identity full;
alter table public.user_state  replica identity full;

-- Add each table to the realtime publication, skipping any that are already in
-- it (add_table errors on duplicates, hence the guard).
do $$
declare
  t text;
begin
  foreach t in array array['goals', 'habits', 'habit_logs', 'user_state'] loop
    if not exists (
      select 1
        from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Note: row-level security still applies to realtime. Each client only receives
-- changes for rows its own RLS policies let it select, so the user_id filter in
-- the client is a narrowing convenience, not the security boundary.
