import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { circuitBreaker } from "@quant/risk";
import type { ExtendedUserGoal } from "./types";
import { logAgentActivity } from "./activity-log";

export type CircuitCheckResult = {
  allowed: boolean;
  reason?: string;
};

export async function checkGoalCircuitBreaker(
  goal: ExtendedUserGoal,
  currentBalance: number,
  cycleId: string
): Promise<CircuitCheckResult> {
  const peak = goal.peak_balance ?? goal.initial_balance ?? currentBalance;
  const drawdownPct =
    peak > 0 ? Math.max(0, (peak - currentBalance) / peak) : 0;
  const dailyLimit = (goal.daily_loss_limit_pct ?? 5) / 100;

  const trip = circuitBreaker.checkHealth({
    lastQuoteAgeMs: 0,
    consecutiveLosses: goal.consecutive_losses ?? 0,
    dailyDrawdownPct: drawdownPct,
    dataStale: false,
    killSwitchActive: goal.kill_switch,
  });

  if (trip.tripped) {
    await logAgentActivity({
      userId: goal.user_id,
      goalId: goal.id,
      cycleId,
      phase: "risk",
      action: "circuit_breaker",
      reasoning: trip.reason,
    });

    if (goal.autonomous_trading) {
      const admin = createSupabaseAdminClient();
      await admin
        .from("user_goals")
        .update({
          status: "paused",
          autonomous_trading: false,
          failure_reason: trip.reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", goal.id);
    }

    return { allowed: false, reason: trip.reason };
  }

  if (drawdownPct >= dailyLimit) {
    const reason = `Daily drawdown ${(drawdownPct * 100).toFixed(2)}% exceeds limit ${goal.daily_loss_limit_pct}%`;
    await logAgentActivity({
      userId: goal.user_id,
      goalId: goal.id,
      cycleId,
      phase: "risk",
      action: "circuit_breaker",
      reasoning: reason,
    });
    return { allowed: false, reason };
  }

  const maxTradesPerDay = 10;
  const today = new Date().toISOString().slice(0, 10);
  let tradesToday = goal.trades_today ?? 0;
  if (goal.trades_today_reset_at !== today) {
    tradesToday = 0;
  }
  if (tradesToday >= maxTradesPerDay) {
    return { allowed: false, reason: `Max ${maxTradesPerDay} trades per day reached` };
  }

  return { allowed: true };
}

export async function activateKillSwitch(
  userId: string,
  goalId?: string,
  flattenAll = false
): Promise<{ success: boolean; message: string }> {
  const admin = createSupabaseAdminClient();

  const query = admin
    .from("user_goals")
    .update({
      kill_switch: true,
      autonomous_trading: false,
      status: "paused",
      failure_reason: "Kill switch activated by user",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (goalId) {
    await query.eq("id", goalId);
  } else {
    await query.eq("autonomous_trading", true);
  }

  await logAgentActivity({
    userId,
    goalId,
    phase: "act",
    action: "kill_switch",
    reasoning: flattenAll ? "Kill switch — flatten all requested" : "Kill switch — trading paused",
    payload: { flattenAll },
  });

  return {
    success: true,
    message: flattenAll
      ? "Kill switch activated. Autonomous trading stopped."
      : "Kill switch activated. No new trades will be placed.",
  };
}

export async function deactivateKillSwitch(userId: string, goalId: string) {
  const admin = createSupabaseAdminClient();
  await admin
    .from("user_goals")
    .update({
      kill_switch: false,
      status: "in_progress",
      failure_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", goalId)
    .eq("user_id", userId);

  circuitBreaker.reset();
}
