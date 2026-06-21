import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ScheduleTaskArgs = {
  task_type: "price_check" | "position_review" | "market_open" | "reminder" | "strategy_check";
  delay_minutes: number;
  symbol?: string;
  condition?: string;
  message?: string;
  conversation_id?: string;
};

export async function scheduleAgentTask(
  userId: string,
  mode: "demo" | "live",
  args: ScheduleTaskArgs,
) {
  const delayMinutes = Math.min(Math.max(args.delay_minutes, 1), 24 * 60);
  const executeAt = new Date(Date.now() + delayMinutes * 60_000);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("scheduled_tasks")
    .insert({
      user_id: userId,
      conversation_id: args.conversation_id ?? null,
      mode,
      task_type: args.task_type,
      task_payload: {
        symbol: args.symbol?.toUpperCase(),
        condition: args.condition,
        message: args.message,
      },
      execute_at: executeAt.toISOString(),
      status: "pending",
    })
    .select("id, task_type, execute_at, task_payload")
    .single();

  if (error) throw new Error(error.message);

  return {
    success: true,
    task: data,
    message: `Scheduled ${args.task_type} in ${delayMinutes} minute(s) at ${executeAt.toISOString()}`,
  };
}

export async function listPendingTaskResults(
  userId: string,
  mode: "demo" | "live",
  since?: string,
) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("scheduled_tasks")
    .select("id, task_type, task_payload, execute_at, executed_at, status, result")
    .eq("user_id", userId)
    .eq("mode", mode)
    .eq("status", "completed")
    .order("executed_at", { ascending: false })
    .limit(20);

  if (since) {
    query = query.gt("executed_at", since);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}
