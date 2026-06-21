-- Trading mode preference + ledger RPCs (required for deposits without service role)

create table if not exists public.user_app_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  trading_mode text not null default 'demo' check (trading_mode in ('demo', 'live')),
  updated_at timestamptz not null default now()
);

alter table public.user_app_preferences enable row level security;

drop policy if exists "Users manage own app preferences" on public.user_app_preferences;
create policy "Users manage own app preferences"
  on public.user_app_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can insert own accounts" on public.accounts;
create policy "Users can insert own accounts"
  on public.accounts for insert
  with check (auth.uid() = user_id);

create unique index if not exists ledger_entries_deposit_idempotency
  on public.ledger_entries (reference_type, reference_id)
  where reference_id is not null
    and reference_type in ('demo_deposit', 'dodo_deposit', 'dgateway_deposit');

create or replace function public.ensure_platform_account(p_mode text)
returns public.accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.accounts;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_mode not in ('demo', 'live') then
    raise exception 'Invalid mode';
  end if;

  select * into v_account
  from public.accounts
  where user_id = v_user_id and mode = p_mode;

  if found then
    return v_account;
  end if;

  insert into public.accounts (user_id, mode, status, kyc_tier, display_currency)
  values (v_user_id, p_mode, 'active', 'tier0', 'USD')
  returning * into v_account;

  return v_account;
end;
$$;

create or replace function public.append_ledger_entry(
  p_account_id uuid,
  p_amount numeric,
  p_entry_type text,
  p_reference_type text,
  p_currency text default 'USD',
  p_reference_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.ledger_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_entry public.ledger_entries;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  if not exists (
    select 1 from public.accounts a
    where a.id = p_account_id and a.user_id = v_user_id
  ) then
    raise exception 'Account not found';
  end if;

  insert into public.ledger_entries (
    account_id, amount, currency, entry_type, reference_type, reference_id, metadata
  ) values (
    p_account_id, p_amount, coalesce(p_currency, 'USD'), p_entry_type,
    p_reference_type, p_reference_id, coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_entry;

  return v_entry;
end;
$$;

create or replace function public.append_signed_adjustment(
  p_account_id uuid,
  p_signed_amount numeric,
  p_reference_type text,
  p_currency text default 'USD',
  p_reference_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.ledger_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_entry public.ledger_entries;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_signed_amount is null or p_signed_amount = 0 then
    raise exception 'Adjustment must be non-zero';
  end if;

  if not exists (
    select 1 from public.accounts a
    where a.id = p_account_id and a.user_id = v_user_id
  ) then
    raise exception 'Account not found';
  end if;

  insert into public.ledger_entries (
    account_id, amount, currency, entry_type, reference_type, reference_id, metadata
  ) values (
    p_account_id, p_signed_amount, coalesce(p_currency, 'USD'), 'adjustment',
    p_reference_type, p_reference_id, coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_entry;

  return v_entry;
end;
$$;

grant execute on function public.ensure_platform_account(text) to authenticated;
grant execute on function public.append_ledger_entry(uuid, numeric, text, text, text, text, jsonb) to authenticated;
grant execute on function public.append_signed_adjustment(uuid, numeric, text, text, text, jsonb) to authenticated;
