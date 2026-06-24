import { assetClassForSymbol } from "@/lib/market/watchlist";
import { capitalAdapter } from "@/lib/execution/capital-adapter";
import { fetchAccountState } from "@/lib/chat/tools/account-state-tool";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ScheduledTaskRow = {
  id: string;
  user_id: string;
  conversation_id: string | null;
  mode: "demo" | "live";
  task_type: string;
  task_payload: {
    symbol?: string;
    condition?: string;
    message?: string;
  };
  execute_at: string;
};

async function executeTask(task: ScheduledTaskRow) {
  const payload = task.task_payload ?? {};

  switch (task.task_type) {
    case "price_check": {
      const symbol = String(payload.symbol ?? "").toUpperCase();
      if (!symbol) {
        return { success: false, error: "No symbol provided" };
      }
      const quote = await capitalAdapter.fetchQuote(symbol, assetClassForSymbol(symbol));
      const spot = quote.spot;
      const condition = typeof payload.condition === "string" ? payload.condition.trim() : "";
      let conditionMet: boolean | null = null;
      if (condition) {
        try {
          // eslint-disable-next-line no-new-func
          conditionMet = Boolean(new Function("price", `return ${condition}`)(spot));
        } catch {
          conditionMet = null;
        }
      }
      return {
        success: true,
        symbol,
        spot,
        change24hPct: quote.change24hPct,
        condition,
        condition_met: conditionMet,
        message:
          conditionMet === true
            ? `Price condition met for ${symbol} at ${spot}`
            : `Price check for ${symbol}: ${spot}`,
      };
    }
    case "position_review": {
      const account = await fetchAccountState(task.user_id, task.mode, {
        include_history: false,
        include_performance: true,
      });
      return {
        success: true,
        balance: account.balance,
        positions: account.positions,
        performance: account.performance,
        message: payload.message ?? "Scheduled position review completed",
      };
    }
    case "reminder":
    case "strategy_check":
    case "market_open":
      return {
        success: true,
        message: payload.message ?? `Scheduled ${task.task_type} fired`,
        symbol: payload.symbol,
      };
    default:
      return { success: false, error: `Unknown task type: ${task.task_type}` };
  }
}

export async function processDueScheduledTasks(limit = 50) {
  const admin = createSupabaseAdminClient();
  const { data: tasks, error } = await admin
    .from("scheduled_tasks")
    .select("id, user_id, conversation_id, mode, task_type, task_payload, execute_at")
    .eq("status", "pending")
    .lte("execute_at", new Date().toISOString())
    .order("execute_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  let processed = 0;
  let failed = 0;

  for (const task of tasks ?? []) {
    await admin
      .from("scheduled_tasks")
      .update({ status: "running" })
      .eq("id", task.id);

    try {
      const result = await executeTask(task as ScheduledTaskRow);
      await admin
        .from("scheduled_tasks")
        .update({
          status: "completed",
          executed_at: new Date().toISOString(),
          result,
        })
        .eq("id", task.id);
      processed += 1;
    } catch (e) {
      await admin
        .from("scheduled_tasks")
        .update({
          status: "failed",
          executed_at: new Date().toISOString(),
          error_message: e instanceof Error ? e.message : String(e),
        })
        .eq("id", task.id);
      failed += 1;
    }
  }

  return { processed, failed, total: (tasks ?? []).length };
}
