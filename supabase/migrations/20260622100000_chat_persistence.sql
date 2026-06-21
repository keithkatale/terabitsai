-- Chat persistence, user goals, and scheduled tasks for autonomous AI quant

-- Conversations table - tracks chat sessions with memory across sessions
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  mode text not null default 'demo' check (mode in ('demo', 'live')),
  
  title text,
  session_number integer not null default 1,
  is_active boolean not null default true,
  
  -- Summary of key context for injection into new sessions
  context_summary text,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_conversations_user_mode
  on public.conversations (user_id, mode, created_at desc);

create index if not exists idx_conversations_user_active
  on public.conversations (user_id, is_active, updated_at desc);

alter table public.conversations enable row level security;

drop policy if exists "Users can manage own conversations" on public.conversations;
create policy "Users can manage own conversations"
  on public.conversations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Chat messages - stores full message structure including tool calls
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  
  role text not null check (role in ('user', 'assistant', 'system')),
  parts jsonb not null default '[]',
  tool_pods jsonb,
  
  -- Sequence for ordering within conversation
  sequence integer not null,
  
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_conversation_seq
  on public.chat_messages (conversation_id, sequence);

alter table public.chat_messages enable row level security;

drop policy if exists "Users can manage own chat messages" on public.chat_messages;
create policy "Users can manage own chat messages"
  on public.chat_messages
  for all
  using (
    conversation_id in (
      select id from public.conversations
      where user_id = auth.uid()
    )
  )
  with check (
    conversation_id in (
      select id from public.conversations
      where user_id = auth.uid()
    )
  );

-- User goals - persistent AI memory of user objectives
create table if not exists public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'demo' check (mode in ('demo', 'live')),
  
  goal_type text not null, -- 'balance_target', 'strategy_preference', 'risk_tolerance', 'milestone'
  goal_value jsonb not null, -- e.g., { "target": 1000, "current": 20, "currency": "USD" }
  description text,
  
  status text not null default 'active' check (status in ('active', 'achieved', 'cancelled', 'paused')),
  progress_pct numeric(5, 2) default 0,
  
  achieved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_goals_user_status
  on public.user_goals (user_id, mode, status);

alter table public.user_goals enable row level security;

drop policy if exists "Users can manage own goals" on public.user_goals;
create policy "Users can manage own goals"
  on public.user_goals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Scheduled tasks - timer system for AI to schedule future actions
create table if not exists public.scheduled_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  mode text not null default 'demo' check (mode in ('demo', 'live')),
  
  task_type text not null, -- 'price_check', 'position_review', 'market_open', 'reminder', 'strategy_check'
  task_payload jsonb not null default '{}',
  
  execute_at timestamptz not null,
  executed_at timestamptz,
  
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  result jsonb,
  error_message text,
  
  -- For recurring tasks
  recurrence_rule text, -- cron-like: '*/30 * * * *' for every 30 min
  next_execution_at timestamptz,
  
  created_at timestamptz not null default now()
);

create index if not exists idx_scheduled_tasks_pending
  on public.scheduled_tasks (status, execute_at)
  where status = 'pending';

create index if not exists idx_scheduled_tasks_user
  on public.scheduled_tasks (user_id, mode, created_at desc);

alter table public.scheduled_tasks enable row level security;

drop policy if exists "Users can manage own scheduled tasks" on public.scheduled_tasks;
create policy "Users can manage own scheduled tasks"
  on public.scheduled_tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Service role can manage all scheduled tasks" on public.scheduled_tasks;
create policy "Service role can manage all scheduled tasks"
  on public.scheduled_tasks
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- AI trade log - audit trail for AI-initiated trades
create table if not exists public.ai_trade_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  position_id uuid references public.positions(id) on delete set null,
  mode text not null check (mode in ('demo', 'live')),
  
  action text not null, -- 'open', 'close', 'modify'
  symbol text not null,
  direction text, -- 'BUY', 'SELL'
  size numeric(20, 8),
  
  -- AI reasoning
  reasoning text,
  confidence_score numeric(3, 2),
  risk_assessment jsonb,
  
  -- Execution details
  requested_at timestamptz not null default now(),
  confirmed_by_user boolean not null default false,
  confirmed_at timestamptz,
  executed_at timestamptz,
  
  execution_result jsonb,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected', 'executed', 'failed'))
);

create index if not exists idx_ai_trade_log_user
  on public.ai_trade_log (user_id, mode, requested_at desc);

alter table public.ai_trade_log enable row level security;

drop policy if exists "Users can read own AI trade logs" on public.ai_trade_log;
create policy "Users can read own AI trade logs"
  on public.ai_trade_log
  for select
  using (auth.uid() = user_id);

drop policy if exists "Service role can manage AI trade logs" on public.ai_trade_log;
create policy "Service role can manage AI trade logs"
  on public.ai_trade_log
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Helper function to get the next session number for a user
create or replace function get_next_session_number(p_user_id uuid, p_mode text)
returns integer
language sql
stable
security definer
as $$
  select coalesce(max(session_number), 0) + 1
  from public.conversations
  where user_id = p_user_id and mode = p_mode;
$$;

-- Helper function to get recent conversation context for a user
create or replace function get_conversation_context(p_user_id uuid, p_mode text, p_limit integer default 5)
returns table (
  conversation_id uuid,
  session_number integer,
  title text,
  context_summary text,
  message_count bigint,
  created_at timestamptz
)
language sql
stable
security definer
as $$
  select 
    c.id as conversation_id,
    c.session_number,
    c.title,
    c.context_summary,
    count(m.id) as message_count,
    c.created_at
  from public.conversations c
  left join public.chat_messages m on m.conversation_id = c.id
  where c.user_id = p_user_id 
    and c.mode = p_mode
  group by c.id
  order by c.created_at desc
  limit p_limit;
$$;

-- Helper function to get pending scheduled tasks
create or replace function get_pending_tasks(p_limit integer default 50)
returns table (
  id uuid,
  user_id uuid,
  conversation_id uuid,
  mode text,
  task_type text,
  task_payload jsonb,
  execute_at timestamptz
)
language sql
stable
security definer
as $$
  select 
    id, user_id, conversation_id, mode, task_type, task_payload, execute_at
  from public.scheduled_tasks
  where status = 'pending'
    and execute_at <= now()
  order by execute_at
  limit p_limit;
$$;
