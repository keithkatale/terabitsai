-- Extend get_active_balance_goals with wealth monitor columns

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
  goal_profile_md text,
  next_wake_at timestamptz,
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
    g.goal_profile_md,
    g.next_wake_at,
    g.created_at,
    g.updated_at
  from public.user_goals g
  where g.goal_type = 'balance_target'
    and g.status in ('active', 'in_progress')
    and g.kill_switch = false
    and (g.next_wake_at is null or g.next_wake_at <= now())
  order by coalesce(g.next_wake_at, g.last_evaluated_at, g.created_at) asc
  limit p_limit;
$$;

notify pgrst, 'reload schema';
