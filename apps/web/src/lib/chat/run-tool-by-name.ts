import { getCapitalAssetCatalog } from "@/lib/catalog/capital-assets";
import { fetchAssetCatalog } from "@/lib/chat/asset-catalog-tool";
import {
  fetchAssetChartData,
  fetchComparativeChartData,
  fetchMarketOverview,
} from "@/lib/chat/market-data-tool";
import type { getSessionContext } from "@/lib/chat/conversation-persistence";
import { SUBAGENT_READ_ONLY_TOOL_NAMES } from "@/lib/chat/tool-declarations";
import { fetchAccountState } from "@/lib/chat/tools/account-state-tool";
import { executeBrokerAction, executeAutonomousTrade, type BrokerActionArgs } from "@/lib/chat/tools/broker-action-tool";
import { manageUserGoals, type ManageGoalArgs } from "@/lib/chat/tools/goal-tool";
import { fetchFundamentals, fetchMacroData } from "@/lib/chat/tools/macro-tools";
import { scheduleAgentTask, type ScheduleTaskArgs } from "@/lib/chat/tools/schedule-task-tool";
import { executeQueryTradingKnowledge } from "@/lib/chat/tools/knowledge-tool";
import { executeWebScrape, executeHttpRequest } from "@/lib/chat/tools/web-tools";
import { executeAnalyzeChart } from "@/lib/chart/analyze-chart-tool";
import {
  resolveAnalyzeChartDefaults,
  inferHyperliquidCoinFromSymbol,
  type MarketsChartSessionContext,
} from "@/lib/chat/markets-chart-context";
import { handleExecuteSkill, normalizeSkillToolArgs } from "@/lib/skills/tool-declaration";
import { handleExecuteWorkflow } from "@/lib/skills/workflow-declaration";
import {
  executeTradingViewNews,
  executeTradingViewOptionsChain,
  executeTradingViewQuote,
  executeTradingViewScreener,
  executeTradingViewSearch,
} from "@/lib/chat/tools/tradingview-tools";
import {
  executeHyperliquidBook,
  executeHyperliquidCandles,
  executeHyperliquidFunding,
  executeHyperliquidMarkets,
} from "@/lib/chat/tools/hyperliquid-tools";
import { searchMarketIntel, getLatestCatalystBrief, getMacroRegime } from "@quant/market-intel";
import type { ChatStreamEvent } from "@/lib/chat/stream-types";
import type { TradingMode } from "@/lib/chat/conversation-persistence";

export type ToolRunContext = {
  userId: string;
  tradingMode: TradingMode;
  conversationId?: string;
  sessionContext: Awaited<ReturnType<typeof getSessionContext>> | null;
  marketsChartContext?: MarketsChartSessionContext | null;
  sendEvent?: (event: ChatStreamEvent) => void;
  /** When set, inform_user routes to subagent_update stream events. */
  subagentId?: string;
};

export type RunToolOptions = {
  /** When set, only these tool names are permitted (used by sub-agents). */
  allowedTools?: Set<string>;
};

export function isToolResultOk(toolResult: unknown): boolean {
  return (
    toolResult != null &&
    typeof toolResult === "object" &&
    (toolResult as { success?: boolean }).success !== false &&
    (toolResult as { error?: boolean }).error !== true
  );
}

export async function runToolByName(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolRunContext,
  options?: RunToolOptions,
): Promise<unknown> {
  const allowed = options?.allowedTools;
  if (allowed && !allowed.has(name)) {
    return { success: false, error: `Tool '${name}' is not available in this agent context.` };
  }

  if (name === "get_all_assets") {
    const filter = args?.asset_class as string | undefined;
    return fetchAssetCatalog(filter);
  }

  if (name === "get_asset_details") {
    const symbol = args?.symbol as string | undefined;
    const allAssets = getCapitalAssetCatalog();
    const asset = symbol
      ? allAssets.find((a) => a.symbol?.toLowerCase() === symbol.toLowerCase())
      : undefined;
    return asset
      ? { success: true, asset }
      : { success: false, error: `Asset '${symbol || "unknown"}' not found.` };
  }

  if (name === "get_asset_market_data") {
    return fetchAssetChartData({
      symbol: args?.symbol as string | undefined,
      query: args?.query as string | undefined,
      range: (args?.range as string | undefined) ?? "1M",
      variant: "area",
    });
  }

  if (name === "render_asset_chart") {
    return fetchAssetChartData({
      symbol: args?.symbol as string | undefined,
      query: args?.query as string | undefined,
      range: (args?.range as string | undefined) ?? "1M",
      variant: (args?.variant as "line" | "area" | undefined) ?? "area",
    });
  }

  if (name === "render_comparative_chart") {
    return fetchComparativeChartData({
      symbol1: String(args?.symbol1 ?? ""),
      symbol2: String(args?.symbol2 ?? ""),
      range: (args?.range as string | undefined) ?? "6M",
    });
  }

  if (name === "analyze_chart") {
    const defaults = resolveAnalyzeChartDefaults(args, ctx.marketsChartContext ?? null);
    return executeAnalyzeChart({
      symbol: defaults.symbol,
      interval: defaults.interval,
      indicators: defaults.indicators,
      range: args?.range as string | undefined,
      style: args?.style as string | undefined,
      question: args?.question as string | undefined,
      userId: ctx.userId,
    });
  }

  if (name === "get_market_overview") {
    const symbols = Array.isArray(args?.symbols) ? (args.symbols as string[]) : undefined;
    return fetchMarketOverview(symbols);
  }

  if (name === "search_market_intel") {
    return {
      success: true,
      results: await searchMarketIntel({
        query: String(args?.query ?? ""),
        symbol: args?.symbol ? String(args.symbol).toUpperCase() : undefined,
        limit: 8,
      }),
    };
  }

  if (name === "get_catalyst_brief") {
    const sym = String(args?.symbol ?? "").toUpperCase();
    const brief = sym ? await getLatestCatalystBrief(sym) : null;
    const regime = await getMacroRegime();
    return {
      success: Boolean(brief),
      brief,
      macroRegime: regime?.regime ?? null,
    };
  }

  if (name === "inform_user") {
    const message = String(args?.message ?? "").trim();
    if (!message) return { success: false, error: "message is required" };
    if (ctx.sendEvent) {
      if (ctx.subagentId) {
        ctx.sendEvent({ type: "subagent_update", id: ctx.subagentId, message });
      } else {
        ctx.sendEvent({ type: "user_update", message });
      }
    }
    return { success: true, acknowledged: true };
  }

  if (name === "spawn_subagents") {
    if (allowed === SUBAGENT_READ_ONLY_TOOL_NAMES) {
      return { success: false, error: "Sub-agents cannot spawn nested sub-agents." };
    }
    if (!ctx.sendEvent) {
      return { success: false, error: "spawn_subagents requires stream context." };
    }
    const subagentsList = (args?.subagents || []) as Array<Record<string, unknown>>;
    const { runSpawnSubagents } = await import("@/lib/chat/spawn-subagents");
    return runSpawnSubagents(subagentsList, ctx);
  }

  if (name === "get_account_state") {
    return fetchAccountState(ctx.userId, ctx.tradingMode, {
      include_history: args?.include_history as boolean | undefined,
      include_positions: args?.include_positions as boolean | undefined,
      include_performance: args?.include_performance as boolean | undefined,
      history_limit: args?.history_limit as number | undefined,
    });
  }

  if (name === "broker_action") {
    return executeBrokerAction(ctx.userId, ctx.tradingMode, {
      action: args?.action as BrokerActionArgs["action"],
      symbol: args?.symbol as string | undefined,
      direction: args?.direction as "BUY" | "SELL" | undefined,
      size: args?.size as number | undefined,
      stop_loss: args?.stop_loss as number | undefined,
      take_profit: args?.take_profit as number | undefined,
      deal_id: args?.deal_id as string | undefined,
      timeframe: args?.timeframe as string | undefined,
      conversation_id: ctx.conversationId,
      reasoning: args?.reasoning as string | undefined,
    });
  }

  if (name === "execute_trade") {
    return executeAutonomousTrade(ctx.userId, ctx.tradingMode, {
      action: (args?.action as "place_order" | "close_position" | undefined) ?? "place_order",
      symbol: args?.symbol as string | undefined,
      direction: args?.direction as "BUY" | "SELL" | undefined,
      size: args?.size as number | undefined,
      stop_loss: args?.stop_loss as number | undefined,
      take_profit: args?.take_profit as number | undefined,
      deal_id: args?.deal_id as string | undefined,
      conversation_id: ctx.conversationId,
      reasoning: args?.reasoning as string | undefined,
    });
  }

  if (name === "execute_skill") {
    const { skill_id, inputs } = normalizeSkillToolArgs(args);
    const balanceGoal = ctx.sessionContext?.goals?.find((g) => g.goal_type === "balance_target");

    let accountBal: number | undefined;
    try {
      const accState = await fetchAccountState(ctx.userId, ctx.tradingMode);
      accountBal = accState?.balance?.total_balance;
    } catch {
      accountBal = undefined;
    }

    if (!skill_id) {
      return { success: false, error: true, message: "skill_id is required" };
    }

    const skillResult = await handleExecuteSkill({
      skill_id,
      inputs,
      userId: ctx.userId,
      goalId: balanceGoal?.id || "",
      mode: ctx.tradingMode,
      accountBalance: accountBal,
    });

    if (skillResult.error) {
      return { error: true, message: skillResult.message };
    }

    return {
      success: true,
      skill_id: skillResult.skill_id,
      data: skillResult.data,
      execution_time_ms: skillResult.execution_time_ms,
      cached: skillResult.cached || false,
    };
  }

  if (name === "execute_workflow") {
    const workflow_id = String(args?.workflow_id ?? "");
    const nested = args?.inputs;
    const inputs =
      nested && typeof nested === "object" && !Array.isArray(nested)
        ? (nested as Record<string, unknown>)
        : {};

    const balanceGoal = ctx.sessionContext?.goals?.find((g) => g.goal_type === "balance_target");

    let accountBal: number | undefined;
    try {
      const accState = await fetchAccountState(ctx.userId, ctx.tradingMode);
      accountBal = accState?.balance?.total_balance;
    } catch {
      accountBal = undefined;
    }

    if (!workflow_id) {
      return { success: false, error: true, message: "workflow_id is required" };
    }

    const wfResult = await handleExecuteWorkflow({
      workflow_id,
      inputs,
      userId: ctx.userId,
      goalId: balanceGoal?.id,
      mode: ctx.tradingMode,
      accountBalance: accountBal,
    });

    if ("tool_error" in wfResult && wfResult.tool_error) {
      return { ...wfResult, error: true, message: wfResult.message };
    }

    return wfResult;
  }

  if (name === "tradingview_quote") {
    return executeTradingViewQuote(args);
  }

  if (name === "tradingview_screener") {
    return executeTradingViewScreener(args);
  }

  if (name === "tradingview_news") {
    return executeTradingViewNews(args);
  }

  if (name === "tradingview_search") {
    return executeTradingViewSearch(args);
  }

  if (name === "tradingview_options_chain") {
    return executeTradingViewOptionsChain(args);
  }

  if (name === "hyperliquid_markets") {
    const coin =
      args.coin != null
        ? String(args.coin)
        : ctx.marketsChartContext?.chartSymbol
          ? inferHyperliquidCoinFromSymbol(ctx.marketsChartContext.chartSymbol)
          : undefined;
    return executeHyperliquidMarkets({ ...args, coin });
  }

  if (name === "hyperliquid_candles") {
    const coin =
      String(args.coin ?? "") ||
      (ctx.marketsChartContext?.chartSymbol
        ? inferHyperliquidCoinFromSymbol(ctx.marketsChartContext.chartSymbol)
        : "");
    return executeHyperliquidCandles({ ...args, coin });
  }

  if (name === "hyperliquid_book") {
    const coin =
      String(args.coin ?? "") ||
      (ctx.marketsChartContext?.chartSymbol
        ? inferHyperliquidCoinFromSymbol(ctx.marketsChartContext.chartSymbol)
        : "");
    return executeHyperliquidBook({ ...args, coin });
  }

  if (name === "hyperliquid_funding") {
    return executeHyperliquidFunding(args);
  }

  if (name === "schedule_task") {
    return scheduleAgentTask(ctx.userId, ctx.tradingMode, {
      task_type: args?.task_type as ScheduleTaskArgs["task_type"],
      delay_minutes: Number(args?.delay_minutes ?? 30),
      symbol: args?.symbol as string | undefined,
      condition: args?.condition as string | undefined,
      message: args?.message as string | undefined,
      conversation_id: ctx.conversationId,
    });
  }

  if (name === "manage_goals") {
    return manageUserGoals(ctx.userId, ctx.tradingMode, {
      operation: args?.operation as ManageGoalArgs["operation"],
      goal_type: args?.goal_type as ManageGoalArgs["goal_type"],
      goal_value: args?.goal_value as Record<string, unknown> | undefined,
      description: args?.description as string | undefined,
      goal_id: args?.goal_id as string | undefined,
      progress_pct: args?.progress_pct as number | undefined,
      status: args?.status as ManageGoalArgs["status"],
      target_balance: args?.target_balance as number | undefined,
      deadline_days: args?.deadline_days as number | undefined,
      autonomous_trading: args?.autonomous_trading as boolean | undefined,
      max_risk_per_trade: args?.max_risk_per_trade as number | undefined,
    });
  }

  if (name === "get_macro_data") {
    const indicators = Array.isArray(args?.indicators) ? (args.indicators as string[]) : undefined;
    return fetchMacroData(indicators);
  }

  if (name === "get_fundamentals") {
    return fetchFundamentals(String(args?.symbol ?? ""));
  }

  if (name === "query_trading_knowledge") {
    return executeQueryTradingKnowledge({
      query: args?.query as string | undefined,
      category: args?.category as string | undefined,
    });
  }

  if (name === "web_scrape") {
    const url = String(args?.url ?? "").trim();
    if (!url) return { success: false, error: "url is required" };
    return executeWebScrape(url);
  }

  if (name === "http_request") {
    const url = String(args?.url ?? "").trim();
    if (!url) return { success: false, error: "url is required" };
    return executeHttpRequest(
      url,
      (args?.method as string) ?? "GET",
      args?.headers as Record<string, string> | undefined,
      args?.body as string | undefined,
    );
  }

  return { success: false, error: "Unknown tool name" };
}
