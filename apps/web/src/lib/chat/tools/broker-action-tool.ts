import { assetClassForSymbol } from "@/lib/market/watchlist";
import { capitalAdapter } from "@/lib/execution/capital-adapter";
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

  if (action === "place_order" || action === "close_position") {
    const supabase = await createSupabaseServerClient();
    const symbol = String(args.symbol ?? "").toUpperCase();

    let estimatedPrice: number | undefined;
    if (symbol && action === "place_order") {
      try {
        const assetClass = assetClassForSymbol(symbol);
        const quote = await capitalAdapter.fetchQuoteStrict(symbol, assetClass);
        estimatedPrice =
          args.direction === "SELL" ? quote.bid : quote.ask;
      } catch {
        // Widget falls back to a default if quote fetch fails.
      }
    }

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
        reasoning: "AI broker_action proposal — awaiting user confirmation",
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
      return { success: false, error: error.message };
    }

    return {
      success: true,
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
        },
      },
      message:
        "Trade proposal logged. Ask the user to confirm via an interactive-question before executing through the investing flow.",
    };
  }

  return { success: false, error: `Unknown action: ${action}` };
}
