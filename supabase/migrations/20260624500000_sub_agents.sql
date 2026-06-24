-- Persist sub-agent widget state on assistant messages
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS sub_agents jsonb;
