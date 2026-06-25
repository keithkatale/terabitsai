import { Type } from "@google/genai";
import { fetchTradingViewQuote, fetchTradingViewScreener, fetchTradingViewOptionsChain } from "@/lib/tradingview/scanner";
import { fetchTradingViewNews, fetchTradingViewSymbolSearch } from "@/lib/tradingview/news";

export const tradingViewQuoteDeclaration = {
  name: "tradingview_quote",
  description:
    "Spot quote from TradingView scanner (close, change, currency). Use for quick TV-aligned prices. Falls back hint if auth required.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      ticker: { type: Type.STRING, description: "Symbol e.g. AAPL, BTCUSD" },
      exchange: { type: Type.STRING, description: "Exchange code e.g. NASDAQ, BINANCE, OANDA" },
    },
    required: ["ticker"],
  },
};

export const tradingViewScreenerDeclaration = {
  name: "tradingview_screener",
  description:
    "TradingView stock/crypto/forex screener — filter by market, columns, JSON filter clauses. Great for finding setups (RSI, volume, sector).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      market: {
        type: Type.STRING,
        description: "america, crypto, forex, futures, bond, or country code",
      },
      columns: {
        type: Type.STRING,
        description: "Comma-separated columns e.g. name,close,change,RSI|60,volume",
      },
      filter: {
        type: Type.STRING,
        description: "JSON array of filter clauses [{left,operation,right}]",
      },
      sort: { type: Type.STRING, description: "field:asc|desc e.g. volume:desc" },
      tickers: { type: Type.STRING, description: "Comma-separated EXCH:SYM list" },
      limit: { type: Type.NUMBER, description: "Max rows 1-500" },
    },
  },
};

export const tradingViewNewsDeclaration = {
  name: "tradingview_news",
  description: "TradingView news headlines, optionally filtered by symbol or category.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbol: { type: Type.STRING, description: "EXCH:SYM filter e.g. NASDAQ:AAPL" },
      category: {
        type: Type.STRING,
        enum: ["base", "stock", "etf", "futures", "forex", "crypto", "index", "bond", "economic"],
      },
      limit: { type: Type.NUMBER, description: "Max headlines (default 25)" },
    },
  },
};

export const tradingViewOptionsChainDeclaration = {
  name: "tradingview_options_chain",
  description:
    "TradingView options chain with greeks and IV. ATM band by default; requires TV session cookie for most symbols.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      ticker: { type: Type.STRING, description: "Underlying e.g. AAPL, TSLA" },
      exchange: { type: Type.STRING, description: "Default NASDAQ" },
      expiry: { type: Type.STRING, description: "ISO date YYYY-MM-DD" },
      type: { type: Type.STRING, enum: ["call", "put"] },
      strikes_around_spot: { type: Type.NUMBER, description: "Half-band (0 = full chain)" },
    },
    required: ["ticker"],
  },
};

export const tradingViewSearchDeclaration = {
  name: "tradingview_search",
  description: "Search TradingView symbol catalog — resolve tickers, exchanges, asset types.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "Search text e.g. AAPL, bitcoin" },
      type: {
        type: Type.STRING,
        enum: ["stock", "crypto", "forex", "futures", "index", "etf", "bond"],
      },
      exchange: { type: Type.STRING, description: "Filter exchange e.g. NASDAQ" },
      limit: { type: Type.NUMBER },
    },
    required: ["query"],
  },
};

export async function executeTradingViewQuote(args: Record<string, unknown>) {
  try {
    const result = await fetchTradingViewQuote(
      String(args.ticker ?? ""),
      String(args.exchange ?? "NASDAQ"),
    );
    if (!result.success) return result;
    const q = result.quote;
    return {
      ...result,
      genui: {
        view: [
          {
            type: "grid",
            columns: 2,
            children: [
              {
                type: "metricCard",
                label: q.symbol,
                value: q.close != null ? `$${q.close.toFixed(2)}` : "—",
                delta: q.change != null ? `${q.change > 0 ? "+" : ""}${q.change.toFixed(2)}%` : undefined,
                trend: q.change != null && q.change > 0 ? "up" : q.change != null && q.change < 0 ? "down" : "flat",
                accent: q.change != null && q.change > 0 ? "emerald" : q.change != null && q.change < 0 ? "rose" : "cyan",
              },
              {
                type: "metricCard",
                label: "Currency",
                value: q.currency ?? "—",
                accent: "zinc",
              },
            ],
          },
        ],
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeTradingViewScreener(args: Record<string, unknown>) {
  try {
    let filter: unknown[] | undefined;
    if (args.filter && typeof args.filter === "string") {
      filter = JSON.parse(args.filter) as unknown[];
    } else if (Array.isArray(args.filter)) {
      filter = args.filter;
    }

    const result = await fetchTradingViewScreener({
      market: args.market ? String(args.market) : undefined,
      columns: args.columns ? String(args.columns).split(",").map((c) => c.trim()) : undefined,
      filter,
      sort: args.sort ? String(args.sort) : undefined,
      tickers: args.tickers ? String(args.tickers).split(",").map((t) => t.trim()) : undefined,
      limit: typeof args.limit === "number" ? args.limit : undefined,
    });

    if (!result.success) return result;

    const items = result.rows.slice(0, 10).map((row) => {
      const name = String(row.name ?? row.symbol ?? "—");
      const close = row.close != null ? Number(row.close) : null;
      const change = row.change != null ? Number(row.change) : null;
      const changeStr =
        change != null && Number.isFinite(change)
          ? `${change > 0 ? "+" : ""}${change.toFixed(2)}%`
          : "";
      return {
        label: name,
        value: close != null && Number.isFinite(close) ? `$${close.toFixed(2)} ${changeStr}` : changeStr || "—",
        accent: change != null && change > 0 ? "emerald" : change != null && change < 0 ? "rose" : "zinc",
      };
    });

    return {
      ...result,
      genui: {
        view: [
          {
            type: "barlist",
            title: `Screener · ${result.market}`,
            items,
          },
        ],
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeTradingViewNews(args: Record<string, unknown>) {
  try {
    const result = await fetchTradingViewNews({
      symbol: args.symbol ? String(args.symbol) : undefined,
      category: args.category ? String(args.category) : undefined,
      limit: typeof args.limit === "number" ? args.limit : undefined,
    });
    if (!result.success) return result;
    const items = result.headlines.slice(0, 8).map((h) => ({
      label: h.provider || "News",
      value: (h.title ?? "").slice(0, 80),
      accent: "cyan",
    }));
    return {
      ...result,
      genui: items.length ? { view: [{ type: "barlist", title: "TradingView news", items }] } : undefined,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeTradingViewSearch(args: Record<string, unknown>) {
  try {
    return await fetchTradingViewSymbolSearch({
      query: String(args.query ?? ""),
      type: args.type ? String(args.type) : undefined,
      exchange: args.exchange ? String(args.exchange) : undefined,
      limit: typeof args.limit === "number" ? args.limit : undefined,
    });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeTradingViewOptionsChain(args: Record<string, unknown>) {
  try {
    const result = await fetchTradingViewOptionsChain({
      ticker: String(args.ticker ?? ""),
      exchange: args.exchange ? String(args.exchange) : undefined,
      expiry: args.expiry ? String(args.expiry) : undefined,
      type: args.type === "call" || args.type === "put" ? args.type : undefined,
      strikesAroundSpot:
        typeof args.strikes_around_spot === "number" ? args.strikes_around_spot : undefined,
    });
    if (!result.success) return result;
    const items = result.chain.slice(0, 12).map((r) => ({
      label: `${r.expiry} ${r.type} ${r.strike}`,
      value: r.mid != null ? `$${r.mid.toFixed(2)} · IV ${r.iv?.toFixed(0) ?? "—"}%` : "—",
      accent: r.type === "call" ? "emerald" : "rose",
    }));
    return {
      ...result,
      genui: items.length
        ? { view: [{ type: "barlist", title: `Options · ${result.underlying}`, items }] }
        : undefined,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
