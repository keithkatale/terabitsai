import { assetClassForSymbol } from "@/lib/market/watchlist";
import { capitalAdapter } from "@/lib/execution/capital-adapter";
import {
  getAccountBalance,
  reserveFunds,
  resolvePlatformAccount,
} from "@/lib/ledger/ledger-service";
import { capturePortfolioSnapshot } from "@/lib/portfolio/capture-snapshot";
import { openPosition, listOpenPositions } from "@/lib/portfolio/positions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { theCage } from "@quant/risk";
import type { TradeProposal, PortfolioState, RiskConfig } from "@quant/contracts";
import type { TradeSetup } from "@quant/strategy";
import type { ExtendedUserGoal } from "./types";
import { logAgentActivity } from "./activity-log";
import { toExtendedGoal } from "./decide-next-action";

async function fetchAutonomousGoal(
  userId: string,
  mode?: "demo" | "live",
): Promise<ExtendedUserGoal | null> {
  const admin = createSupabaseAdminClient();
  const base = () =>
    admin
      .from("user_goals")
      .select("*")
      .eq("user_id", userId)
      .eq("goal_type", "balance_target")
      .eq("autonomous_trading", true)
      .eq("kill_switch", false)
      .in("status", ["active", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1);

  if (mode) {
    const { data: modeMatch } = await base().eq("mode", mode).maybeSingle();
    if (modeMatch) return toExtendedGoal(modeMatch as Record<string, unknown>);
  }

  const { data } = await base().maybeSingle();
  if (!data) return null;
  return toExtendedGoal(data as Record<string, unknown>);
}

export async function getActiveAutonomousGoal(
  userId: string,
  mode: "demo" | "live",
): Promise<ExtendedUserGoal | null> {
  return fetchAutonomousGoal(userId, mode);
}

export async function isAutonomousTradingActive(
  userId: string,
  mode: "demo" | "live",
): Promise<boolean> {
  const goal = await fetchAutonomousGoal(userId, mode);
  return goal != null;
}

function buildSetupFromBrokerArgs(params: {
  symbol: string;
  direction: "BUY" | "SELL";
  entry: number;
  stop_loss?: number;
  take_profit?: number;
  reasoning?: string;
}): TradeSetup {
  const { symbol, direction, entry } = params;
  const stopDistance =
    params.stop_loss != null
      ? Math.abs(entry - params.stop_loss)
      : entry * 0.02;
  const atrStop =
    params.stop_loss ??
    (direction === "BUY" ? entry - stopDistance : entry + stopDistance);
  const defaultTarget =
    direction === "BUY" ? entry * 1.04 : entry * 0.96;

  return {
    symbol: symbol.toUpperCase(),
    direction,
    entry,
    atrStop,
    stopDistance,
    targets: [params.take_profit ?? defaultTarget],
    confluenceScore: 70,
    rationale: [params.reasoning ?? "Command AI trade"],
    regime: "trend",
    timeframeBias: direction === "BUY" ? "bullish" : "bearish",
    timeframeSetup: direction === "BUY" ? "bullish" : "bearish",
    timeframeTrigger: direction === "BUY" ? "bullish" : "bearish",
  };
}

/** Execute a broker place_order when autonomous trading is enabled. */
export async function executeAutonomousBrokerOrder(params: {
  userId: string;
  mode: "demo" | "live";
  symbol: string;
  direction: "BUY" | "SELL";
  size?: number;
  stop_loss?: number;
  take_profit?: number;
  conversation_id?: string;
  reasoning?: string;
  cycleId?: string;
  queueIfAboveThreshold?: boolean;
}) {
  const goal = await getActiveAutonomousGoal(params.userId, params.mode);
  if (!goal) return null;

  const symbol = params.symbol.toUpperCase();
  const assetClass = assetClassForSymbol(symbol);
  const quote = await capitalAdapter.fetchQuoteStrict(symbol, assetClass);
  const entry = params.direction === "BUY" ? quote.ask : quote.bid;
  const setup = buildSetupFromBrokerArgs({
    symbol,
    direction: params.direction,
    entry,
    stop_loss: params.stop_loss,
    take_profit: params.take_profit,
    reasoning: params.reasoning,
  });

  const cycleId = params.cycleId ?? `chat-${Date.now()}`;
  const queueIfAboveThreshold = params.queueIfAboveThreshold ?? false;
  const result = await executeTradeSetup({
    goal,
    setup,
    reasoning: params.reasoning ?? `Autonomous ${params.direction} ${symbol}`,
    cycleId,
    queueIfAboveThreshold,
    sizeOverride: params.size,
  });

  if (result.executed) {
    return {
      success: true,
      executed: true,
      autonomous: true,
      trade_id: result.tradeId,
      deal_id: result.dealId,
      message: result.message,
      symbol,
      direction: params.direction,
      size: result.size,
      entry_price: result.entryPrice,
      mode: params.mode,
    };
  }

  if (result.queued) {
    return {
      success: false,
      executed: false,
      queued: true,
      autonomous: true,
      trade_id: result.tradeId,
      error: result.message,
      message: `${result.message} Autonomous mode does not use swipe confirmation — adjust size or risk limits.`,
    };
  }

  return {
    success: false,
    autonomous: true,
    error: result.message,
    message: result.message,
  };
}

/** Close a position when autonomous trading is enabled. */
export async function executeAutonomousBrokerClose(params: {
  userId: string;
  mode: "demo" | "live";
  deal_id?: string;
  symbol?: string;
  reasoning?: string;
  cycleId?: string;
}) {
  const goal = await getActiveAutonomousGoal(params.userId, params.mode);
  if (!goal) return null;

  const account = await resolvePlatformAccount(params.userId, params.mode);
  const positions = await listOpenPositions(account.id);

  let dealId = params.deal_id;
  if (!dealId && params.symbol) {
    const sym = params.symbol.toUpperCase();
    dealId = positions.find((p) => p.symbol.toUpperCase() === sym)?.external_id;
  }
  if (!dealId) {
    return { success: false, autonomous: true, error: "Position not found to close" };
  }

  const cycleId = params.cycleId ?? `chat-${Date.now()}`;
  const result = await closePositionForGoal({
    goal,
    dealId,
    reasoning: params.reasoning ?? "Command AI close",
    cycleId,
  });

  return { ...result, autonomous: true, executed: result.success, deal_id: dealId };
}

export function computePositionSize(
  accountBalance: number,
  setup: TradeSetup,
  goal: ExtendedUserGoal
): { marginUsd: number; riskPct: number } {
  const riskPct = goal.max_risk_per_trade ?? 5;
  const maxPositionPct = goal.max_position_pct ?? 10;
  const riskAmount = accountBalance * (riskPct / 100);
  const stopDistance = setup.stopDistance || setup.entry * 0.01;
  let marginUsd = stopDistance > 0 ? riskAmount / (stopDistance / setup.entry) : riskAmount;
  marginUsd = Math.min(marginUsd, accountBalance * (maxPositionPct / 100));
  marginUsd = Math.max(Math.min(marginUsd, accountBalance * 0.25), 1);
  const actualRiskPct = accountBalance > 0 ? (marginUsd / accountBalance) * 100 : 0;
  return { marginUsd, riskPct: actualRiskPct };
}

function buildProposal(setup: TradeSetup, reasoning: string): TradeProposal {
  const stopPct = setup.entry > 0 ? setup.stopDistance / setup.entry : 0.01;
  return {
    symbol: setup.symbol,
    side: setup.direction,
    confidence: setup.confluenceScore / 100,
    timeHorizon: "swing",
    rationale: reasoning,
    agentVotes: [],
    suggestedStopPct: stopPct,
    suggestedSizeHint: 0.05,
  };
}

export async function executeTradeSetup(params: {
  goal: ExtendedUserGoal;
  setup: TradeSetup;
  reasoning: string;
  cycleId: string;
  queueIfAboveThreshold?: boolean;
  sizeOverride?: number;
}): Promise<{
  executed: boolean;
  queued: boolean;
  tradeId?: string;
  dealId?: string;
  size?: number;
  entryPrice?: number;
  message: string;
}> {
  const { goal, setup, reasoning, cycleId } = params;
  const account = await resolvePlatformAccount(goal.user_id, goal.mode);
  const balance = await getAccountBalance(account.id, "USD");
  const accountBalance = balance.available ?? 0;

  const { marginUsd, riskPct } = computePositionSize(accountBalance, setup, goal);
  const threshold = goal.confirmation_threshold_pct ?? 3;

  const openPositions = await listOpenPositions(account.id);
  if (openPositions.length >= (goal.max_concurrent_positions ?? 3)) {
    return { executed: false, queued: false, message: "Max concurrent positions reached" };
  }

  const portfolio: PortfolioState = {
    accountBalance,
    availableMargin: balance.available ?? accountBalance,
    dailyPnl: 0,
    openPositions: openPositions.map((p) => ({
      symbol: p.symbol,
      side: p.side === "long" ? "BUY" : "SELL",
      volume: p.quantity,
      entryPrice: p.entry_price,
      unrealizedPnl: p.unrealized_pnl_usd ?? 0,
      dealId: p.external_id,
    })),
    consecutiveLosses: goal.consecutive_losses ?? 0,
    dataStale: false,
  };

  const proposal = buildProposal(setup, reasoning);
  const riskConfig: RiskConfig = {
    maxRiskPerTradePct: (goal.max_risk_per_trade ?? 5) / 100,
    maxDailyLossPct: (goal.daily_loss_limit_pct ?? 5) / 100,
    maxPositionSizePct: (goal.max_position_pct ?? 10) / 100,
    maxTotalExposurePct: 0.5,
    maxLeverage: 10,
    minStopPct: 0.005,
    maxOpenPositions: goal.max_concurrent_positions ?? 3,
    maxConsecutiveLosses: 3,
    killSwitchActive: goal.kill_switch,
    liveExecutionEnabled: process.env.LIVE_EXECUTION_ENABLED === "true",
  };

  const cageResult = theCage.evaluate({
    proposal,
    portfolio,
    config: riskConfig,
    currentPrice: setup.entry,
    lastQuoteAgeMs: 0,
  });

  if (!cageResult.approved) {
    return { executed: false, queued: false, message: cageResult.reasons.join("; ") };
  }

  const admin = createSupabaseAdminClient();
  const clientOrderId = `goal-${goal.id}-${cycleId}-${setup.symbol}`;
  const symbol = setup.symbol.toUpperCase();
  const direction = setup.direction;
  const leverage = 5;

  if (params.queueIfAboveThreshold !== false && riskPct > threshold) {
    const { data: tradeRow } = await admin
      .from("ai_trade_log")
      .insert({
        user_id: goal.user_id,
        mode: goal.mode,
        action: "open",
        symbol,
        direction,
        reasoning: `[Goal ${goal.id}] ${reasoning}`,
        status: "pending",
        risk_assessment: { setup, cycleId, clientOrderId, marginUsd },
      })
      .select("id")
      .single();

    await admin.from("trade_decisions").insert({
      user_id: goal.user_id,
      goal_id: goal.id,
      cycle_id: cycleId,
      symbol,
      direction,
      confluence_score: setup.confluenceScore,
      conviction_score: setup.confluenceScore,
      approved: true,
      executed: false,
      rationale: setup.rationale,
      trade_setup: setup,
      trade_id: tradeRow?.id,
    });

    await logAgentActivity({
      userId: goal.user_id,
      goalId: goal.id,
      cycleId,
      phase: "act",
      action: "trade_queued",
      symbol,
      reasoning: `Above ${threshold}% threshold — awaiting confirmation`,
      payload: { tradeId: tradeRow?.id, riskPct },
    });

    return {
      executed: false,
      queued: true,
      tradeId: tradeRow?.id,
      message: `Queued for confirmation (${riskPct.toFixed(1)}% > ${threshold}%)`,
    };
  }

  try {
    const assetClass = assetClassForSymbol(symbol);
    const quote = await capitalAdapter.fetchQuoteStrict(symbol, assetClass);
    const indicativePrice = direction === "BUY" ? quote.ask : quote.bid;
    const maxMargin = accountBalance * ((goal.max_position_pct ?? 10) / 100);
    let size: number;
    if (params.sizeOverride != null && params.sizeOverride > 0) {
      size = params.sizeOverride;
      const marginNeeded = (size * indicativePrice) / leverage;
      if (marginNeeded > maxMargin + 0.01) {
        return {
          executed: false,
          queued: false,
          message: `Requested size exceeds max position cap ($${maxMargin.toFixed(2)} margin)`,
        };
      }
    } else {
      const notional = marginUsd * leverage;
      size = Math.round((notional / indicativePrice) * 1_000_000) / 1_000_000;
    }

    const { data: logRow, error: logError } = await admin
      .from("ai_trade_log")
      .insert({
        user_id: goal.user_id,
        mode: goal.mode,
        action: "open",
        symbol,
        direction,
        reasoning: `[Goal ${goal.id}] ${reasoning}`,
        status: "pending",
        risk_assessment: { setup, cycleId, clientOrderId, marginUsd, autonomous: true },
      })
      .select("id")
      .single();

    if (logError || !logRow) {
      return { executed: false, queued: false, message: logError?.message ?? "Log failed" };
    }

    const capitalResult = await capitalAdapter.createPosition(symbol, direction, size);
    const entryPrice = capitalResult.price > 0 ? capitalResult.price : indicativePrice;
    const margin = Math.round(((size * entryPrice) / leverage) * 100) / 100;

    await reserveFunds(account.id, margin, "trade", capitalResult.dealId, {
      symbol,
      side: direction === "BUY" ? "buy" : "sell",
      timestamp: new Date().toISOString(),
      quantity: size,
      entry_price: entryPrice,
      leverage,
      source: "autonomous_manager",
      goal_id: goal.id,
      cycle_id: cycleId,
    });

    await openPosition({
      accountId: account.id,
      mode: goal.mode,
      externalId: capitalResult.dealId,
      symbol,
      side: direction === "BUY" ? "long" : "short",
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

    await admin.from("trade_decisions").insert({
      user_id: goal.user_id,
      goal_id: goal.id,
      cycle_id: cycleId,
      symbol,
      direction,
      confluence_score: setup.confluenceScore,
      conviction_score: setup.confluenceScore,
      approved: true,
      executed: true,
      rationale: setup.rationale,
      trade_setup: setup,
      trade_id: logRow.id,
    });

    const today = new Date().toISOString().slice(0, 10);
    await admin
      .from("user_goals")
      .update({
        trades_today: (goal.trades_today_reset_at === today ? goal.trades_today : 0) + 1,
        trades_today_reset_at: today,
        peak_balance: Math.max(goal.peak_balance ?? accountBalance, accountBalance),
        last_evaluated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", goal.id);

    await capturePortfolioSnapshot(account.id, goal.mode, { reason: "trade", force: true }).catch(() => {});

    await logAgentActivity({
      userId: goal.user_id,
      goalId: goal.id,
      cycleId,
      phase: "act",
      action: "trade_executed",
      symbol,
      reasoning,
      payload: { dealId: capitalResult.dealId, marginUsd: margin, tradeId: logRow.id },
    });

    return {
      executed: true,
      queued: false,
      tradeId: logRow.id,
      dealId: capitalResult.dealId,
      size,
      entryPrice,
      message: `Executed ${direction} ${size} ${symbol} @ ${entryPrice} via Capital.com`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Execution failed";
    await logAgentActivity({
      userId: goal.user_id,
      goalId: goal.id,
      cycleId,
      phase: "act",
      action: "error",
      symbol: setup.symbol,
      reasoning: message,
    });
    return { executed: false, queued: false, message };
  }
}

export async function closePositionForGoal(params: {
  goal: ExtendedUserGoal;
  dealId: string;
  percent?: number;
  reasoning: string;
  cycleId: string;
}) {
  const { goal, dealId, percent, reasoning, cycleId } = params;
  const account = await resolvePlatformAccount(goal.user_id, goal.mode);
  const positions = await listOpenPositions(account.id);
  const pos = positions.find((p) => p.external_id === dealId);
  if (!pos) return { success: false, message: "Position not found" };

  const closeSize = percent != null && percent < 100 ? (pos.quantity * percent) / 100 : undefined;
  await capitalAdapter.closePosition(dealId, closeSize);

  await logAgentActivity({
    userId: goal.user_id,
    goalId: goal.id,
    cycleId,
    phase: "manage",
    action: "position_closed",
    symbol: pos.symbol,
    reasoning,
    payload: { dealId, percent },
  });

  await capturePortfolioSnapshot(account.id, goal.mode, { reason: "close", force: true }).catch(() => {});
  return { success: true, message: `Closed ${pos.symbol}` };
}
