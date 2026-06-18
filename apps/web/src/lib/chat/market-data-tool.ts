import { capitalAdapter } from "@/lib/execution/capital-adapter";
import { resolveAssetSymbol } from "./resolve-asset-symbol";

function rangeToDays(range: string): number {
  const r = range.trim().toUpperCase();
  if (r === "1D" || r === "1") return 1;
  if (r === "1W" || r === "7") return 7;
  if (r === "3M" || r === "90") return 90;
  if (r === "6M" || r === "180") return 180;
  if (r === "1Y" || r === "365") return 365;
  return 30;
}

function formatLabel(ts: number, rangeDays: number): string {
  const d = new Date(ts * 1000);
  if (rangeDays <= 7) {
    return d.toLocaleDateString("en-US", { weekday: "short" });
  }
  if (rangeDays <= 90) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short" });
}

export async function fetchAssetMarketData(args: {
  symbol?: string;
  query?: string;
  range?: string;
}) {
  const lookup = args.symbol ?? args.query ?? "";
  const asset = resolveAssetSymbol(lookup);
  if (!asset) {
    return {
      success: false,
      error: `Could not resolve asset for "${lookup}". Try a ticker like BTCUSD, AAPL, or GOLD.`,
    };
  }

  const rangeDays = rangeToDays(args.range ?? "1M");

  try {
    const [quote, candles] = await Promise.all([
      capitalAdapter.fetchQuote(asset.symbol, asset.asset_class ?? ""),
      capitalAdapter.fetchCandles(asset.symbol, asset.asset_class ?? "", rangeDays),
    ]);

    const closes = candles.map((c) => c.c);
    const labels = candles.map((c) => formatLabel(c.t, rangeDays));
    const high = candles.length ? Math.max(...candles.map((c) => c.h)) : quote.spot;
    const low = candles.length ? Math.min(...candles.map((c) => c.l)) : quote.spot;

    const sample = candles.slice(-60).map((c) => ({
      t: c.t,
      o: c.o,
      h: c.h,
      l: c.l,
      c: c.c,
      v: c.v,
    }));

    const metricCard = {
      type: "metricCard" as const,
      label: asset.symbol,
      value: quote.spot,
      delta:
        quote.change24hPct != null
          ? `${quote.change24hPct >= 0 ? "+" : ""}${quote.change24hPct.toFixed(2)}%`
          : undefined,
      trend:
        quote.change24hPct == null
          ? ("flat" as const)
          : quote.change24hPct >= 0
            ? ("up" as const)
            : ("down" as const),
      accent: "amber" as const,
      sparkline: closes.slice(-8),
    };

    const chart = {
      type: "chart" as const,
      variant: "area" as const,
      title: `${asset.display_name} · ${args.range ?? "1M"}`,
      labels: labels.slice(-12),
      series: [{ name: asset.symbol, data: closes.slice(-12), color: "amber" }],
    };

    return {
      success: true,
      symbol: asset.symbol,
      display_name: asset.display_name,
      asset_class: asset.asset_class,
      sector: asset.sector,
      range: args.range ?? "1M",
      quote: {
        spot: quote.spot,
        bid: quote.bid,
        ask: quote.ask,
        change24hPct: quote.change24hPct,
      },
      stats: { high, low, points: candles.length },
      sparkline: closes.slice(-12),
      labels: labels.slice(-12),
      candles: sample,
      /** Paste this object verbatim into a ```genui fence — do not rewrite. */
      genui: {
        view: [metricCard, chart],
      },
      genui_hint: { chart, metricCard },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      symbol: asset.symbol,
      error: `Market data fetch failed: ${message}`,
    };
  }
}

const OVERVIEW_DEFAULTS = ["BTCUSD", "ETHUSD", "US100", "GOLD", "AAPL"];

export async function fetchMarketOverview(symbols?: string[]) {
  const list = (symbols?.length ? symbols : OVERVIEW_DEFAULTS).slice(0, 6);
  const results = await Promise.all(
    list.map((symbol) => fetchAssetMarketData({ symbol, range: "1M" }))
  );

  const cards = results
    .filter((r) => r.success && r.quote)
    .map((r, i) => ({
      type: "metricCard" as const,
      label: r.display_name ?? r.symbol,
      value: r.quote!.spot,
      delta:
        r.quote!.change24hPct != null
          ? `${r.quote!.change24hPct >= 0 ? "+" : ""}${r.quote!.change24hPct.toFixed(2)}%`
          : undefined,
      trend:
        r.quote!.change24hPct == null
          ? ("flat" as const)
          : r.quote!.change24hPct >= 0
            ? ("up" as const)
            : ("down" as const),
      accent: (["amber", "violet", "cyan", "emerald", "sky", "rose"] as const)[i % 6],
      sparkline: (r.sparkline ?? []).slice(-8),
    }));

  if (cards.length === 0) {
    return { success: false, error: "Could not load market overview data." };
  }

  return {
    success: true,
    symbols: list,
    cards: results,
    /** Server-built layout — injected directly, never rewritten by the model. */
    genui: {
      view: [{ type: "grid", columns: Math.min(3, cards.length), children: cards }],
    },
  };
}
