-- Autonomous wealth manager: activity feed, trade decisions audit, goal risk caps

alter table public.user_goals
  add column if not exists max_concurrent_positions integer not null default 3,
  add column if not exists max_position_pct numeric(5, 2) not null default 10.00,
  add column if not exists daily_loss_limit_pct numeric(5, 2) not null default 5.00,
  add column if not exists allowed_assets jsonb not null default '[]'::jsonb,
  add column if not exists min_confluence_score numeric(5, 2) not null default 60.00,
  add column if not exists kill_switch boolean not null default false,
  add column if not exists confirmation_threshold_pct numeric(5, 2) not null default 3.00,
  add column if not exists peak_balance numeric(18, 2),
  add column if not exists trades_today integer not null default 0,
  add column if not exists trades_today_reset_at date;

create table if not exists public.agent_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references public.user_goals(id) on delete set null,
  cycle_id uuid,
  phase text not null,
  action text not null,
  symbol text,
  reasoning text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_activity_user_time
  on public.agent_activity (user_id, created_at desc);

create index if not exists idx_agent_activity_goal_time
  on public.agent_activity (goal_id, created_at desc)
  where goal_id is not null;

create table if not exists public.trade_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references public.user_goals(id) on delete set null,
  cycle_id uuid,
  symbol text not null,
  direction text not null check (direction in ('BUY', 'SELL')),
  confluence_score numeric(5, 2),
  conviction_score numeric(5, 2),
  approved boolean not null default false,
  executed boolean not null default false,
  rejection_reason text,
  rationale jsonb not null default '[]'::jsonb,
  trade_setup jsonb,
  trade_id uuid references public.ai_trade_log(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_trade_decisions_user_time
  on public.trade_decisions (user_id, created_at desc);

create table if not exists public.autonomous_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references public.user_goals(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_autonomous_events_pending
  on public.autonomous_events (created_at asc)
  where processed_at is null;

create table if not exists public.worker_heartbeat (
  id text primary key default 'wealth-manager',
  last_beat_at timestamptz not null default now(),
  status text not null default 'running',
  metadata jsonb not null default '{}'::jsonb
);

insert into public.worker_heartbeat (id, status)
values ('wealth-manager', 'stopped')
on conflict (id) do nothing;

alter table public.agent_activity enable row level security;
alter table public.trade_decisions enable row level security;
alter table public.autonomous_events enable row level security;
alter table public.worker_heartbeat enable row level security;

drop policy if exists "Users can read own agent activity" on public.agent_activity;
create policy "Users can read own agent activity"
  on public.agent_activity for select
  using (user_id = auth.uid());

drop policy if exists "Service role manages agent activity" on public.agent_activity;
create policy "Service role manages agent activity"
  on public.agent_activity for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Users can read own trade decisions" on public.trade_decisions;
create policy "Users can read own trade decisions"
  on public.trade_decisions for select
  using (user_id = auth.uid());

drop policy if exists "Service role manages trade decisions" on public.trade_decisions;
create policy "Service role manages trade decisions"
  on public.trade_decisions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages autonomous events" on public.autonomous_events;
create policy "Service role manages autonomous events"
  on public.autonomous_events for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Anyone can read worker heartbeat" on public.worker_heartbeat;
create policy "Anyone can read worker heartbeat"
  on public.worker_heartbeat for select
  using (true);

drop policy if exists "Service role manages worker heartbeat" on public.worker_heartbeat;
create policy "Service role manages worker heartbeat"
  on public.worker_heartbeat for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop function if exists get_active_balance_goals(integer);

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
  max_concurrent_positions integer,
  max_position_pct numeric,
  daily_loss_limit_pct numeric,
  allowed_assets jsonb,
  min_confluence_score numeric,
  kill_switch boolean,
  confirmation_threshold_pct numeric,
  peak_balance numeric,
  trades_today integer,
  trades_today_reset_at date,
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
    g.max_concurrent_positions,
    g.max_position_pct,
    g.daily_loss_limit_pct,
    g.allowed_assets,
    g.min_confluence_score,
    g.kill_switch,
    g.confirmation_threshold_pct,
    g.peak_balance,
    g.trades_today,
    g.trades_today_reset_at,
    g.achieved_at,
    g.created_at,
    g.updated_at
  from public.user_goals g
  where g.goal_type = 'balance_target'
    and g.status in ('active', 'in_progress')
    and g.kill_switch = false
  order by coalesce(g.last_evaluated_at, g.created_at) asc
  limit p_limit;
$$;

notify pgrst, 'reload schema';
