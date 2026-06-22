-- Wealth Monitor: persistent goal profile and dynamic wake scheduling

alter table public.user_goals
  add column if not exists goal_profile_md text,
  add column if not exists next_wake_at timestamptz;

comment on column public.user_goals.goal_profile_md is
  'Living goal.md profile maintained by the Wealth Monitor AI';

comment on column public.user_goals.next_wake_at is
  'When the monitor should run its next analysis cycle (overrides fixed interval when set)';
