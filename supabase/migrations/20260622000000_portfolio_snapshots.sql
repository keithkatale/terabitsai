-- Portfolio wealth snapshots and persisted CFD positions

create table if not exists public.portfolio_wealth_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  mode text not null check (mode in ('demo', 'live')),

  wallet_available_usd numeric(20, 8) not null default 0,
  order_locked_usd numeric(20, 8) not null default 0,
  savings_locked_usd numeric(20, 8) not null default 0,
  invested_value_usd numeric(20, 8) not null default 0,
  total_balance_usd numeric(20, 8) not null default 0,

  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_portfolio_snapshots_account_mode
  on public.portfolio_wealth_snapshots (account_id, mode, recorded_at desc);

alter table public.portfolio_wealth_snapshots enable row level security;

drop policy if exists "Users can read own portfolio snapshots" on public.portfolio_wealth_snapshots;
create policy "Users can read own portfolio snapshots"
  on public.portfolio_wealth_snapshots
  for select
  using (
    account_id in (
      select id from public.accounts
      where user_id = auth.uid()
    )
  );

drop policy if exists "Service role can manage portfolio snapshots" on public.portfolio_wealth_snapshots;
create policy "Service role can manage portfolio snapshots"
  on public.portfolio_wealth_snapshots
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  mode text not null check (mode in ('demo', 'live')),
  external_id text not null,

  symbol text not null,
  side text not null check (side in ('long', 'short')),
  quantity numeric(20, 8) not null,
  entry_price numeric(20, 8) not null,
  current_price numeric(20, 8),
  leverage numeric(10, 2) not null default 1,
  margin_usd numeric(20, 8) not null default 0,
  cost_basis_usd numeric(20, 8) not null,
  market_value_usd numeric(20, 8),
  unrealized_pnl_usd numeric(20, 8),

  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  status text not null default 'open' check (status in ('open', 'closed')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_positions_account_external
  on public.positions (account_id, external_id);

create index if not exists idx_positions_account_status
  on public.positions (account_id, status, opened_at desc);

alter table public.positions enable row level security;

drop policy if exists "Users can read own positions" on public.positions;
create policy "Users can read own positions"
  on public.positions
  for select
  using (
    account_id in (
      select id from public.accounts
      where user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own positions" on public.positions;
create policy "Users can insert own positions"
  on public.positions
  for insert
  with check (
    account_id in (
      select id from public.accounts
      where user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own positions" on public.positions;
create policy "Users can update own positions"
  on public.positions
  for update
  using (
    account_id in (
      select id from public.accounts
      where user_id = auth.uid()
    )
  )
  with check (
    account_id in (
      select id from public.accounts
      where user_id = auth.uid()
    )
  );

drop policy if exists "Service role can manage positions" on public.positions;
create policy "Service role can manage positions"
  on public.positions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
