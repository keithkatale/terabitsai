-- Goal tracking extensions for autonomous balance-target monitoring

alter table public.user_goals
  add column if not exists initial_balance numeric(18, 2),
  add column if not exists target_balance numeric(18, 2),
  add column if not exists deadline_at timestamptz,
  add column if not exists last_evaluated_at timestamptz,
  add column if not exists failure_reason text,
  add column if not exists autonomous_trading boolean not null default false,
  add column if not exists max_risk_per_trade numeric(5, 2) not null default 5.00,
  add column if not exists consecutive_losses integer not null default 0;

alter table public.user_goals drop constraint if exists user_goals_status_check;
alter table public.user_goals add constraint user_goals_status_check
  check (status in ('active', 'in_progress', 'achieved', 'failed', 'cancelled', 'paused'));

create index if not exists idx_user_goals_balance_monitor
  on public.user_goals (goal_type, status, last_evaluated_at)
  where goal_type = 'balance_target' and status in ('active', 'in_progress');

create table if not exists public.goal_evaluations (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.user_goals(id) on delete cascade,
  evaluated_at timestamptz not null default now(),
  current_balance numeric(18, 2),
  progress_pct numeric(5, 2),
  action_taken text not null default 'none',
  reasoning text,
  trade_id uuid references public.ai_trade_log(id) on delete set null
);

create index if not exists idx_goal_evaluations_goal_time
  on public.goal_evaluations (goal_id, evaluated_at desc);

alter table public.goal_evaluations enable row level security;

drop policy if exists "Users can read own goal evaluations" on public.goal_evaluations;
create policy "Users can read own goal evaluations"
  on public.goal_evaluations
  for select
  using (
    goal_id in (
      select id from public.user_goals where user_id = auth.uid()
    )
  );

drop policy if exists "Service role can manage goal evaluations" on public.goal_evaluations;
create policy "Service role can manage goal evaluations"
  on public.goal_evaluations
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage all user goals" on public.user_goals;
create policy "Service role can manage all user goals"
  on public.user_goals
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function get_active_balance_goals(p_limit integer default 100)
returns table (
  id uuid,
  user_id uuid,
  mode text,
  goal_type text,
  goal_value jsonb,
  description text,
  status text,
  progress_pct numeric,
  initial_balance numeric,
  target_balance numeric,
  deadline_at timestamptz,
  last_evaluated_at timestamptz,
  failure_reason text,
  autonomous_trading boolean,
  max_risk_per_trade numeric,
  consecutive_losses integer,
  achieved_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
as $$
  select
    g.id,
    g.user_id,
    g.mode,
    g.goal_type,
    g.goal_value,
    g.description,
    g.status,
    g.progress_pct,
    g.initial_balance,
    g.target_balance,
    g.deadline_at,
    g.last_evaluated_at,
    g.failure_reason,
    g.autonomous_trading,
    g.max_risk_per_trade,
    g.consecutive_losses,
    g.achieved_at,
    g.created_at,
    g.updated_at
  from public.user_goals g
  where g.goal_type = 'balance_target'
    and g.status in ('active', 'in_progress')
  order by coalesce(g.last_evaluated_at, g.created_at) asc
  limit p_limit;
$$;

notify pgrst, 'reload schema';
