-- User account profiles (onboarding questionnaire) and Terabits credits

create table if not exists public.user_account_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  onboarding_completed boolean not null default false,
  onboarding_completed_at timestamptz,
  user_persona text,
  trading_experience text,
  markets_of_interest text[] default '{}',
  goal text,
  income_band text,
  amount_available numeric,
  weekly_target_amount numeric,
  risk_preference text check (risk_preference in ('low', 'medium', 'high')),
  horizon_days integer,
  profile_summary text,
  raw_profile jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_account_profiles enable row level security;

create policy "Users read own profile"
  on public.user_account_profiles for select
  using (auth.uid() = user_id);

create policy "Users insert own profile"
  on public.user_account_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users update own profile"
  on public.user_account_profiles for update
  using (auth.uid() = user_id);

create table if not exists public.user_credits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  trial_granted boolean not null default false,
  trial_granted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_credits enable row level security;

create policy "Users read own credits"
  on public.user_credits for select
  using (auth.uid() = user_id);

create policy "Users insert own credits"
  on public.user_credits for insert
  with check (auth.uid() = user_id);

create policy "Users update own credits"
  on public.user_credits for update
  using (auth.uid() = user_id);

create or replace function public.grant_trial_credits(p_user_id uuid, p_amount integer default 3000)
returns public.user_credits
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.user_credits;
begin
  insert into public.user_credits (user_id, balance, trial_granted, trial_granted_at)
  values (p_user_id, p_amount, true, now())
  on conflict (user_id) do update
    set balance = case
          when user_credits.trial_granted then user_credits.balance
          else excluded.balance
        end,
        trial_granted = user_credits.trial_granted or excluded.trial_granted,
        trial_granted_at = coalesce(user_credits.trial_granted_at, excluded.trial_granted_at),
        updated_at = now()
  returning * into row;
  return row;
end;
$$;

create or replace function public.deduct_user_credits(p_user_id uuid, p_amount integer default 1)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  update public.user_credits
  set balance = greatest(0, balance - p_amount),
      updated_at = now()
  where user_id = p_user_id
  returning balance into new_balance;
  return coalesce(new_balance, 0);
end;
$$;
