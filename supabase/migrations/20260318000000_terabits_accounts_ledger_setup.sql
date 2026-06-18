-- Terabits AI: accounts mode, balances view, RLS, and ledger RPCs
-- Applied via Supabase MCP to project wsxzbqfeafzccprlllpu

alter table public.accounts
  add column if not exists mode text not null default 'demo';

alter table public.accounts
  drop constraint if exists accounts_user_id_key;

create unique index if not exists accounts_user_id_mode_key
  on public.accounts (user_id, mode);

drop view if exists public.balances;

create or replace view public.balances as
select
  le.account_id,
  le.currency,
  coalesce(sum(case
    when le.entry_type in ('deposit', 'release', 'trade_credit', 'savings_release', 'savings_interest')
      then le.amount
    when le.entry_type in ('withdrawal', 'trade_debit', 'fee', 'savings_penalty')
      then -le.amount
    when le.entry_type in ('reserve', 'savings_lock')
      then -le.amount
    when le.entry_type = 'adjustment'
      then le.amount
    else 0
  end), 0)::numeric(20, 8) as available,
  coalesce(sum(case
    when le.entry_type = 'reserve' then le.amount
    when le.entry_type = 'release' then -le.amount
    else 0
  end), 0)::numeric(20, 8) as locked,
  coalesce(sum(case
    when le.entry_type = 'savings_lock' then le.amount
    when le.entry_type = 'savings_release' then -le.amount
    else 0
  end), 0)::numeric(20, 8) as savings_locked
from public.ledger_entries le
group by le.account_id, le.currency;

create index if not exists idx_ledger_entries_account_created
  on public.ledger_entries (account_id, created_at desc);

alter table public.accounts enable row level security;
alter table public.ledger_entries enable row level security;

drop policy if exists "Users can read own accounts" on public.accounts;
create policy "Users can read own accounts"
  on public.accounts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read own ledger entries" on public.ledger_entries;
create policy "Users can read own ledger entries"
  on public.ledger_entries for select
  using (exists (
    select 1 from public.accounts a
    where a.id = account_id and a.user_id = auth.uid()
  ));

drop policy if exists "Service role can manage accounts" on public.accounts;
create policy "Service role can manage accounts"
  on public.accounts for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage ledger entries" on public.ledger_entries;
create policy "Service role can manage ledger entries"
  on public.ledger_entries for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- See Supabase MCP migration terabits_accounts_ledger_setup for RPC function bodies.
