-- Allow authenticated users to insert and update their own AI trade log rows

drop policy if exists "Users can insert own AI trade logs" on public.ai_trade_log;
create policy "Users can insert own AI trade logs"
  on public.ai_trade_log
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own AI trade logs" on public.ai_trade_log;
create policy "Users can update own AI trade logs"
  on public.ai_trade_log
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
