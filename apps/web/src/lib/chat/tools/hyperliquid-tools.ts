import { Type } from "@google/genai";
import {
  fetchHyperliquidBook,
  fetchHyperliquidCandles,
  fetchHyperliquidFundingCompare,
  fetchHyperliquidFundingHistory,
  fetchHyperliquidMarkets,
} from "@/lib/hyperliquid/client";
import {
  buildHyperliquidBookGenui,
  buildHyperliquidCandlesGenui,
  buildHyperliquidFundingGenui,
  buildHyperliquidMarketGenui,
  buildHyperliquidMarketsListGenui,
} from "@/lib/hyperliquid/genui";

export const hyperliquidMarketsDeclaration = {
  name: "hyperliquid_markets",
  description:
    "Hyperliquid perp markets — mark price, 24h change, funding APR, open interest, volume. Public API, no auth.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      coin: { type: Type.STRING, description: "Filter by coin e.g. BTC, ETH" },
      sort: {
        type: Type.STRING,
        enum: ["dayNtlVlm", "change24hPct", "fundingAprPct", "openInterest", "markPx"],
      },
      limit: { type: Type.NUMBER },
    },
  },
};

export const hyperliquidCandlesDeclaration = {
  name: "hyperliquid_candles",
  description: "Hyperliquid OHLCV candles for a perp coin.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      coin: { type: Type.STRING, description: "Perp coin e.g. BTC, ETH, SOL" },
      interval: {
        type: Type.STRING,
        enum: ["1m", "5m", "15m", "1h", "4h", "1d"],
      },
      limit: { type: Type.NUMBER, description: "Number of candles (max 5000)" },
    },
    required: ["coin"],
  },
};

export const hyperliquidBookDeclaration = {
  name: "hyperliquid_book",
  description: "Hyperliquid L2 order book snapshot with best bid/ask and spread.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      coin: { type: Type.STRING },
      depth: { type: Type.NUMBER, description: "Levels per side (1-20)" },
    },
    required: ["coin"],
  },
};

export const hyperliquidFundingDeclaration = {
  name: "hyperliquid_funding",
  description:
    "Hyperliquid funding data — mode=history for hourly funding, mode=compare for cross-venue arb screen.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      mode: { type: Type.STRING, enum: ["history", "compare"], description: "Default: compare" },
      coin: { type: Type.STRING },
      hours: { type: Type.NUMBER, description: "For history mode — hours to look back" },
      limit: { type: Type.NUMBER },
    },
  },
};

export async function executeHyperliquidMarkets(args: Record<string, unknown>) {
  try {
    const result = await fetchHyperliquidMarkets({
      coin: args.coin ? String(args.coin) : undefined,
      sort: args.sort ? String(args.sort) : undefined,
      limit: typeof args.limit === "number" ? args.limit : undefined,
    });
    if (!result.success) return result;

    const genui =
      result.markets.length === 1
        ? buildHyperliquidMarketGenui(result.markets[0])
        : buildHyperliquidMarketsListGenui(result.markets);

    return { ...result, genui };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeHyperliquidCandles(args: Record<string, unknown>) {
  try {
    const result = await fetchHyperliquidCandles({
      coin: String(args.coin ?? ""),
      interval: args.interval ? String(args.interval) : undefined,
      limit: typeof args.limit === "number" ? args.limit : undefined,
    });
    if (!result.success) return result;
    return { ...result, genui: buildHyperliquidCandlesGenui(result) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeHyperliquidBook(args: Record<string, unknown>) {
  try {
    const result = await fetchHyperliquidBook({
      coin: String(args.coin ?? ""),
      depth: typeof args.depth === "number" ? args.depth : undefined,
    });
    if (!result.success) return result;
    return { ...result, genui: buildHyperliquidBookGenui(result) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeHyperliquidFunding(args: Record<string, unknown>) {
  try {
    const mode = String(args.mode ?? "compare");
    if (mode === "history") {
      const result = await fetchHyperliquidFundingHistory({
        coin: String(args.coin ?? "BTC"),
        hours: typeof args.hours === "number" ? args.hours : undefined,
      });
      if (!result.success) return result;
      const latest = result.history[result.history.length - 1];
      return {
        ...result,
        genui: latest
          ? buildHyperliquidFundingGenui(latest as Record<string, unknown>, "history")
          : undefined,
      };
    }
    const result = await fetchHyperliquidFundingCompare({
      coin: args.coin ? String(args.coin) : undefined,
      limit: typeof args.limit === "number" ? args.limit : undefined,
    });
    if (!result.success) return result;
    const row = result.funding[0];
    return {
      ...result,
      genui: row ? buildHyperliquidFundingGenui(row, "compare") : undefined,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** @deprecated use inferHyperliquidCoinFromSymbol from markets-chart-context */
export function inferHyperliquidCoin(symbol: string): string {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.endsWith("USD")) return s.slice(0, -3);
  if (s.endsWith("USDT")) return s.slice(0, -4);
  return s;
}
