import { randomUUID } from "crypto";
import { CapitalBroker } from "@quant/broker";
import { scanAndRankSetups } from "@quant/strategy";
import { evaluateBalanceGoal } from "@/lib/goals/goal-evaluator";
import { checkGoalCircuitBreaker } from "./circuit-guard";
import { executeTradeSetup } from "./execution";
import { judgeTopSetups } from "./judge";
import { manageOpenPositions } from "./position-manager";
import { logAgentActivity } from "./activity-log";
import type { DecisionOutcome, ExtendedUserGoal, GoalContext } from "./types";

function toExtendedGoal(row: Record<string, unknown>): ExtendedUserGoal {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    mode: row.mode as "demo" | "live",
    goal_type: String(row.goal_type),
    goal_value: (row.goal_value as Record<string, unknown>) ?? {},
    description: row.description as string | null,
    status: row.status as ExtendedUserGoal["status"],
    progress_pct: row.progress_pct != null ? Number(row.progress_pct) : null,
    initial_balance: row.initial_balance != null ? Number(row.initial_balance) : null,
    target_balance: row.target_balance != null ? Number(row.target_balance) : null,
    deadline_at: row.deadline_at as string | null,
    last_evaluated_at: row.last_evaluated_at as string | null,
    failure_reason: row.failure_reason as string | null,
    autonomous_trading: Boolean(row.autonomous_trading),
    max_risk_per_trade: Number(row.max_risk_per_trade ?? 5),
    consecutive_losses: Number(row.consecutive_losses ?? 0),
    max_concurrent_positions: Number(row.max_concurrent_positions ?? 3),
    max_position_pct: Number(row.max_position_pct ?? 10),
    daily_loss_limit_pct: Number(row.daily_loss_limit_pct ?? 5),
    allowed_assets: Array.isArray(row.allowed_assets)
      ? (row.allowed_assets as string[])
      : [],
    min_confluence_score: Number(row.min_confluence_score ?? 60),
    kill_switch: Boolean(row.kill_switch),
    confirmation_threshold_pct: Number(row.confirmation_threshold_pct ?? 3),
    peak_balance: row.peak_balance != null ? Number(row.peak_balance) : null,
    trades_today: Number(row.trades_today ?? 0),
    trades_today_reset_at: row.trades_today_reset_at as string | null,
    achieved_at: row.achieved_at as string | null,
    goal_profile_md: (row.goal_profile_md as string | null) ?? null,
    next_wake_at: (row.next_wake_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export { toExtendedGoal };

export async function decideNextAction(
  goalRow: Record<string, unknown>
): Promise<{ outcome: DecisionOutcome; cycleId: string; narration: string }> {
  const goal = toExtendedGoal(goalRow);
  const cycleId = randomUUID();

  await logAgentActivity({
    userId: goal.user_id,
    goalId: goal.id,
    cycleId,
    phase: "observe",
    action: "cycle_start",
    reasoning: "Autonomous cycle started",
  });

  if (goal.kill_switch || !goal.autonomous_trading) {
    const outcome: DecisionOutcome = {
      type: "paused",
      reasoning: goal.kill_switch ? "Kill switch active" : "Autonomous trading disabled",
    };
    return { outcome, cycleId, narration: outcome.reasoning };
  }

  const evaluation = await evaluateBalanceGoal(goal);
  const currentBalance = evaluation.currentBalance;
  const targetBalance = goal.target_balance ?? Number(goal.goal_value?.target ?? 0);

  const circuit = await checkGoalCircuitBreaker(goal, currentBalance, cycleId);
  if (!circuit.allowed) {
    return {
      outcome: { type: "paused", reasoning: circuit.reason ?? "Circuit breaker" },
      cycleId,
      narration: `I've paused trading: ${circuit.reason}`,
    };
  }

  await manageOpenPositions(goal, cycleId);

  if (evaluation.status === "achieved") {
    await logAgentActivity({
      userId: goal.user_id,
      goalId: goal.id,
      cycleId,
      phase: "report",
      action: "goal_achieved",
      reasoning: "Target balance reached",
    });
    return {
      outcome: { type: "hold", reasoning: "Goal achieved" },
      cycleId,
      narration: `Congratulations! We've reached your target of $${targetBalance.toFixed(2)}.`,
    };
  }

  const broker = CapitalBroker.fromEnv();
  const allowedAssets =
    goal.allowed_assets.length > 0 ? goal.allowed_assets : undefined;

  await logAgentActivity({
    userId: goal.user_id,
    goalId: goal.id,
    cycleId,
    phase: "scan",
    action: "hold",
    reasoning: "Scanning markets for opportunities",
  });

  const setups = await scanAndRankSetups(broker, {
    minConfluence: goal.min_confluence_score ?? 60,
    allowedAssets,
    limit: 5,
  });

  if (setups.length === 0) {
    await logAgentActivity({
      userId: goal.user_id,
      goalId: goal.id,
      cycleId,
      phase: "analyze",
      action: "hold",
      reasoning: "No setups above confluence threshold",
    });
    return {
      outcome: { type: "hold", reasoning: "No qualifying setups — holding" },
      cycleId,
      narration:
        "I'm monitoring the markets. No high-conviction opportunity right now — I'll act when one appears.",
    };
  }

  const judgments = await judgeTopSetups(
    setups,
    {
      currentBalance,
      targetBalance,
      progressPct: evaluation.progressPct,
    },
    3
  );

  const approved = judgments.find((j) => j.judgment.approved);
  if (!approved) {
    const reason = judgments[0]?.judgment.reasoning ?? "No approved setups";
    await logAgentActivity({
      userId: goal.user_id,
      goalId: goal.id,
      cycleId,
      phase: "judge",
      action: "skipped",
      reasoning: reason,
    });
    return {
      outcome: { type: "hold", reasoning: reason },
      cycleId,
      narration: judgments[0]?.judgment.narration ?? "I reviewed the market but didn't find a trade worth taking.",
    };
  }

  const { setup, judgment } = approved;
  const execResult = await executeTradeSetup({
    goal,
    setup,
    reasoning: judgment.reasoning,
    cycleId,
    queueIfAboveThreshold: false,
  });

  if (execResult.executed) {
    const narration = `${judgment.narration} Trade executed on ${setup.symbol}.`;
    await logAgentActivity({
      userId: goal.user_id,
      goalId: goal.id,
      cycleId,
      phase: "report",
      action: "cycle_end",
      symbol: setup.symbol,
      reasoning: narration,
    });
    return {
      outcome: {
        type: "execute",
        symbol: setup.symbol,
        direction: setup.direction,
        size: 0,
        stopLoss: setup.atrStop,
        takeProfit: setup.targets[0],
        reasoning: judgment.reasoning,
        tradeId: execResult.tradeId,
      },
      cycleId,
      narration,
    };
  }

  if (execResult.queued) {
    const narration = `${judgment.narration} This trade needs your confirmation because it's above the risk threshold.`;
    return {
      outcome: {
        type: "queue_confirm",
        symbol: setup.symbol,
        direction: setup.direction,
        size: 0,
        stopLoss: setup.atrStop,
        takeProfit: setup.targets[0],
        reasoning: judgment.reasoning,
        tradeId: execResult.tradeId!,
      },
      cycleId,
      narration,
    };
  }

  return {
    outcome: { type: "hold", reasoning: execResult.message },
    cycleId,
    narration: execResult.message,
  };
}

export async function runAutonomousCycleForGoal(
  goalRow: Record<string, unknown>
): Promise<DecisionOutcome> {
  const { outcome } = await decideNextAction(goalRow);
  return outcome;
}
