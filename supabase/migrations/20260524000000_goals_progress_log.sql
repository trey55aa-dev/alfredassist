-- Daily progress logging on goals: per-day snapshots and last-check-in stamp.
-- Both fields are nullable so existing rows stay valid.
alter table public.goals
  add column if not exists progress_log jsonb,
  add column if not exists last_check_in date;
