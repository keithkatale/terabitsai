import { assetClassForSymbol } from "@/lib/market/watchlist";
import { capitalAdapter } from "@/lib/execution/capital-adapter";
import {
  executeAutonomousBrokerClose,
  executeAutonomousBrokerOrder,
} from "@/lib/autonomous/execution";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type BrokerActionArgs = {
  action:
    | "get_quote"
    | "get_positions"
    | "get_account"
    | "get_candles"
    | "place_order"
    | "close_position";
  symbol?: string;
  direction?: "BUY" | "SELL";
  size?: number;
  stop_loss?: number;
  take_profit?: number;
  deal_id?: string;
  timeframe?: string;
  conversation_id?: string;
  reasoning?: string;
  cycle_id?: string;
};

function rangeDaysFromTimeframe(timeframe?: string): number {
  switch ((timeframe ?? "1M").toUpperCase()) {
    case "1D":
      return 1;
    case "1W":
      return 7;
    case "3M":
      return 90;
    case "6M":
      return 180;
    case "1Y":
      return 365;
    default:
      return 30;
  }
}

async function tradeLogDb() {
  try {
    return createSupabaseAdminClient();
  } catch {
    return await createSupabaseServerClient();
  }
}

async function logTradeProposal(
  userId: string,
  mode: "demo" | "live",
  args: BrokerActionArgs,
  action: "place_order" | "close_position",
  estimatedPrice?: number,
) {
  const supabase = await tradeLogDb();
  const symbol = String(args.symbol ?? "").toUpperCase();

  const { data: logRow, error } = await supabase
    .from("ai_trade_log")
    .insert({
      user_id: userId,
      conversation_id: args.conversation_id ?? null,
      mode,
      action: action === "place_order" ? "open" : "close",
      symbol: symbol || "UNKNOWN",
      direction: args.direction ?? null,
      size: args.size ?? null,
      reasoning: args.reasoning ?? "AI broker_action proposal — awaiting user confirmation",
      status: "pending",
      risk_assessment: {
        stop_loss: args.stop_loss ?? null,
        take_profit: args.take_profit ?? null,
        deal_id: args.deal_id ?? null,
      },
    })
    .select("id")
    .single();

  if (error) {
    return { success: false as const, error: error.message };
  }

  return {
    success: true as const,
    requires_confirmation: true,
    trade_log_id: logRow.id,
    proposal: {
      action,
      symbol,
      direction: args.direction,
      size: args.size,
      stop_loss: args.stop_loss,
      take_profit: args.take_profit,
      deal_id: args.deal_id,
    },
    genui: {
      type: "component",
      name: "TradeConfirmationWidget",
      props: {
        symbol,
        direction: args.direction ?? "BUY",
        size: args.size ?? 0.1,
        leverage: 5,
        estimatedPrice,
        mode,
        tradeLogId: logRow.id,
      },
    },
    message:
      mode === "live"
        ? "Live trade proposal logged. Ask the user to swipe to confirm on the trade ticket."
        : "Paper trade proposal logged. Ask the user to swipe to confirm on the trade ticket.",
  };
}

export async function executeBrokerAction(
  userId: string,
  mode: "demo" | "live",
  args: BrokerActionArgs,
) {
  const action = args.action;

  if (action === "get_account") {
    const accounts = await capitalAdapter.getAccounts();
    return { success: true, accounts, mode };
  }

  if (action === "get_positions") {
    const positions = await capitalAdapter.getOpenPositions();
    return { success: true, positions, mode };
  }

  if (action === "get_quote") {
    const symbol = String(args.symbol ?? "").toUpperCase();
    if (!symbol) return { success: false, error: "symbol is required" };
    const assetClass = assetClassForSymbol(symbol);
    const quote = await capitalAdapter.fetchQuoteStrict(symbol, assetClass);
    return { success: true, quote };
  }

  if (action === "get_candles") {
    const symbol = String(args.symbol ?? "").toUpperCase();
    if (!symbol) return { success: false, error: "symbol is required" };
    const assetClass = assetClassForSymbol(symbol);
    const rangeDays = rangeDaysFromTimeframe(args.timeframe);
    const candles = await capitalAdapter.fetchCandles(symbol, assetClass, rangeDays);
    return { success: true, symbol, candles, rangeDays };
  }

  if (action === "place_order") {
    const symbol = String(args.symbol ?? "").toUpperCase();
    const direction = args.direction;
    if (!symbol || !direction) {
      return { success: false, error: "symbol and direction are required for place_order" };
    }

    const autoResult = await executeAutonomousBrokerOrder({
      userId,
      mode,
      symbol,
      direction,
      size: args.size,
      stop_loss: args.stop_loss,
      take_profit: args.take_profit,
      conversation_id: args.conversation_id,
      reasoning: args.reasoning,
      cycleId: args.cycle_id,
    });

    if (autoResult) {
      if (autoResult.executed) {
        return {
          ...autoResult,
          message: `Trade executed automatically: ${autoResult.message}`,
        };
      }
      if (autoResult.queued) {
        return autoResult;
      }
      if (!autoResult.success) {
        return autoResult;
      }
    }

    let estimatedPrice: number | undefined;
    try {
      const assetClass = assetClassForSymbol(symbol);
      const quote = await capitalAdapter.fetchQuoteStrict(symbol, assetClass);
      estimatedPrice = direction === "SELL" ? quote.bid : quote.ask;
    } catch {
      /* widget fallback */
    }

    return logTradeProposal(userId, mode, args, "place_order", estimatedPrice);
  }

  if (action === "close_position") {
    const autoResult = await executeAutonomousBrokerClose({
      userId,
      mode,
      deal_id: args.deal_id,
      symbol: args.symbol,
      reasoning: args.reasoning,
      cycleId: args.cycle_id,
    });

    if (autoResult) {
      const msg =
        autoResult.success && "message" in autoResult
          ? `Position closed automatically: ${autoResult.message ?? "done"}`
          : ("error" in autoResult ? autoResult.error : undefined) ?? "Close failed";
      return { ...autoResult, message: msg };
    }

    return logTradeProposal(userId, mode, args, "close_position");
  }

  return { success: false, error: `Unknown action: ${action}` };
}
