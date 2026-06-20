-- Streak-goal support on goals: type, streak start date, per-day log, relapse log.
-- All nullable so existing rows stay valid. The client (goalsRepo) also degrades
-- gracefully and strips these columns if this migration hasn't been applied yet.
alter table public.goals
  add column if not exists goal_type    text,
  add column if not exists streak_start date,
  add column if not exists daily_log    jsonb,
  add column if not exists relapse_log  jsonb;
