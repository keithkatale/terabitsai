import { assetClassForSymbol } from "@/lib/market/watchlist";
import { capitalAdapter } from "@/lib/execution/capital-adapter";
import {
  getAccountBalance,
  reserveFunds,
  resolvePlatformAccount,
} from "@/lib/ledger/ledger-service";
import { capturePortfolioSnapshot } from "@/lib/portfolio/capture-snapshot";
import { openPosition, listOpenPositions } from "@/lib/portfolio/positions";
import { fetchAccountState } from "@/lib/chat/tools/account-state-tool";
import { generateVertexTextCompletion } from "@/lib/gemini/vertex-text-completion";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  GoalAgentDecision,
  GoalEvaluation,
  GoalEvaluationAction,
  UserGoal,
} from "@/lib/goals/types";

function parseAgentDecision(raw: string): GoalAgentDecision | null {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as GoalAgentDecision;
    if (parsed.action !== "hold" && parsed.action !== "trade" && parsed.action !== "close") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function runGoalAgentTurn(
  goal: UserGoal,
  evaluation: GoalEvaluation,
): Promise<{
  actionTaken: GoalEvaluationAction;
  reasoning: string;
  tradeId?: string;
  decision?: GoalAgentDecision;
}> {
  if (goal.consecutive_losses >= 3) {
    return {
      actionTaken: "autonomous_paused",
      reasoning: "Autonomous trading paused after 3 consecutive losing evaluations",
    };
  }

  const accountState = await fetchAccountState(goal.user_id, goal.mode, {
    include_history: false,
    include_performance: true,
  });
  const account = await resolvePlatformAccount(goal.user_id, goal.mode);
  const localPositions = await listOpenPositions(account.id).catch(() => []);

  const initial = goal.initial_balance ?? Number(goal.goal_value?.initial ?? 0);
  const target = goal.target_balance ?? Number(goal.goal_value?.target ?? 0);

  const systemInstruction = `You are an autonomous portfolio manager working toward a user balance goal.
Respond with ONLY valid JSON (no markdown):
{
  "action": "hold" | "trade" | "close",
  "reasoning": "brief explanation",
  "trade": { "symbol": "BTCUSD", "direction": "BUY", "allocationUsd": 2, "leverage": 5 },
  "close": { "deal_id": "...", "percent": 100 }
}

Rules:
- Be conservative; only trade when there is a clear edge.
- Never risk more than ${goal.max_risk_per_trade}% of account per trade.
- Prefer hold when progress is on track.
- Use allocationUsd for margin sizing, not notional.
- Only include trade or close when action requires it.`;

  const userPrompt = `Goal: grow $${initial} → $${target}
Current balance: $${evaluation.currentBalance.toFixed(2)}
Progress: ${evaluation.progressPct.toFixed(1)}%
Status: ${evaluation.status}
Suggested action: ${evaluation.suggestedAction ?? "hold"}
Wallet available: $${accountState.balance?.wallet_available?.toFixed(2) ?? "unknown"}
Open positions: ${accountState.positions?.length ?? 0}
Positions: ${JSON.stringify(
    localPositions.slice(0, 5).map((p) => ({
      symbol: p.symbol,
      side: p.side,
      margin: p.margin_usd,
      pnl: p.unrealized_pnl_usd,
      deal_id: p.external_id,
    })),
  )}

Decide the next action toward the goal.`;

  let decision: GoalAgentDecision;
  try {
    const raw = await generateVertexTextCompletion({
      systemInstruction,
      userPrompt,
      temperature: 0.2,
      maxTokens: 512,
    });
    const parsed = parseAgentDecision(raw);
    if (!parsed) {
      return { actionTaken: "none", reasoning: "Agent returned unparseable decision — holding" };
    }
    decision = parsed;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agent turn failed";
    return { actionTaken: "none", reasoning: message };
  }

  if (decision.action === "hold") {
    return { actionTaken: "none", reasoning: decision.reasoning, decision };
  }

  if (!goal.autonomous_trading) {
    return {
      actionTaken: "trade_proposed",
      reasoning: `${decision.reasoning} (autonomous trading disabled — user confirmation required)`,
      decision,
    };
  }

  if (decision.action === "close" && decision.close?.deal_id) {
    const result = await executeAutonomousClose(goal, decision);
    return result;
  }

  if (decision.action === "trade" && decision.trade) {
    const result = await executeAutonomousTrade(goal, decision);
    return result;
  }

  return { actionTaken: "none", reasoning: decision.reasoning, decision };
}

async function executeAutonomousTrade(
  goal: UserGoal,
  decision: GoalAgentDecision,
): Promise<{
  actionTaken: GoalEvaluationAction;
  reasoning: string;
  tradeId?: string;
  decision?: GoalAgentDecision;
}> {
  const trade = decision.trade!;
  const symbol = trade.symbol.toUpperCase();
  const direction = trade.direction;
  const leverage = trade.leverage ?? 5;
  const allocationUsd = trade.allocationUsd;

  const account = await resolvePlatformAccount(goal.user_id, goal.mode);
  const balance = await getAccountBalance(account.id, "USD");
  const maxRiskUsd =
    (balance.available * (goal.max_risk_per_trade ?? 5)) / 100;

  if (allocationUsd > maxRiskUsd) {
    return {
      actionTaken: "none",
      reasoning: `Trade rejected: allocation $${allocationUsd} exceeds max risk $${maxRiskUsd.toFixed(2)}`,
      decision,
    };
  }

  if (allocationUsd > balance.available) {
    return {
      actionTaken: "none",
      reasoning: "Trade rejected: insufficient wallet balance",
      decision,
    };
  }

  const admin = createSupabaseAdminClient();
  const { data: logRow, error: logError } = await admin
    .from("ai_trade_log")
    .insert({
      user_id: goal.user_id,
      mode: goal.mode,
      action: "open",
      symbol,
      direction,
      size: null,
      reasoning: `[Goal ${goal.id}] ${decision.reasoning}`,
      status: "pending",
      risk_assessment: { allocationUsd, leverage, goal_id: goal.id, autonomous: true },
    })
    .select("id")
    .single();

  if (logError || !logRow) {
    return {
      actionTaken: "none",
      reasoning: logError?.message ?? "Failed to log autonomous trade",
      decision,
    };
  }

  try {
    const assetClass = assetClassForSymbol(symbol);
    const quote = await capitalAdapter.fetchQuoteStrict(symbol, assetClass);
    const side = direction === "BUY" ? "buy" : "sell";
    const indicativePrice = side === "buy" ? quote.ask : quote.bid;
    const notional = allocationUsd * leverage;
    const size = Math.round((notional / indicativePrice) * 1_000_000) / 1_000_000;

    const capitalResult = await capitalAdapter.createPosition(symbol, direction, size);
    const entryPrice =
      capitalResult.price > 0 ? capitalResult.price : indicativePrice;
    const margin = Math.round(((size * entryPrice) / leverage) * 100) / 100;

    await reserveFunds(account.id, margin, "trade", capitalResult.dealId, {
      symbol,
      side: side === "buy" ? "buy" : "sell",
      timestamp: new Date().toISOString(),
      quantity: size,
      entry_price: entryPrice,
      leverage,
      source: "goal_autonomous",
      allocation_usd: allocationUsd,
      capital_deal_id: capitalResult.dealId,
    });

    await openPosition({
      accountId: account.id,
      mode: goal.mode,
      externalId: capitalResult.dealId,
      symbol,
      side: side === "buy" ? "long" : "short",
      quantity: size,
      entryPrice,
      leverage,
      marginUsd: margin,
    });

    await admin
      .from("ai_trade_log")
      .update({
        status: "executed",
        confirmed_by_user: false,
        executed_at: new Date().toISOString(),
        execution_result: capitalResult,
      })
      .eq("id", logRow.id);

    try {
      await capturePortfolioSnapshot(account.id, goal.mode, {
        reason: "trade",
        force: true,
      });
    } catch {
      /* non-fatal */
    }

    return {
      actionTaken: "trade_executed",
      reasoning: decision.reasoning,
      tradeId: logRow.id,
      decision,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Trade execution failed";
    await admin
      .from("ai_trade_log")
      .update({ status: "failed", execution_result: { error: message } })
      .eq("id", logRow.id);

    await admin
      .from("user_goals")
      .update({
        consecutive_losses: (goal.consecutive_losses ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", goal.id);

    return {
      actionTaken: "none",
      reasoning: message,
      tradeId: logRow.id,
      decision,
    };
  }
}

async function executeAutonomousClose(
  goal: UserGoal,
  decision: GoalAgentDecision,
): Promise<{
  actionTaken: GoalEvaluationAction;
  reasoning: string;
  tradeId?: string;
  decision?: GoalAgentDecision;
}> {
  const dealId = decision.close!.deal_id;
  const percent = decision.close!.percent ?? 100;

  const admin = createSupabaseAdminClient();
  const { data: logRow } = await admin
    .from("ai_trade_log")
    .insert({
      user_id: goal.user_id,
      mode: goal.mode,
      action: "close",
      symbol: "UNKNOWN",
      reasoning: `[Goal ${goal.id}] ${decision.reasoning}`,
      status: "pending",
      risk_assessment: { deal_id: dealId, percent, goal_id: goal.id, autonomous: true },
    })
    .select("id")
    .single();

  try {
    await capitalAdapter.closePosition(dealId);
    if (logRow?.id) {
      await admin
        .from("ai_trade_log")
        .update({
          status: "executed",
          executed_at: new Date().toISOString(),
        })
        .eq("id", logRow.id);
    }

    const account = await resolvePlatformAccount(goal.user_id, goal.mode);
    try {
      await capturePortfolioSnapshot(account.id, goal.mode, {
        reason: "close",
        force: true,
      });
    } catch {
      /* non-fatal */
    }

    return {
      actionTaken: "trade_executed",
      reasoning: decision.reasoning,
      tradeId: logRow?.id,
      decision,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Close failed";
    return { actionTaken: "none", reasoning: message, tradeId: logRow?.id, decision };
  }
}
