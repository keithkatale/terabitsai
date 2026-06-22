import { capitalAdapter, type CapitalCandle } from "@/lib/execution/capital-adapter";
import { resolveAssetSymbol } from "./resolve-asset-symbol";

export type ChartRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y";

export type ChartCandle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
};

export function rangeToDays(range: string | undefined): number {
  const r = (range ?? "1M").trim().toUpperCase();
  if (r === "1D" || r === "1") return 1;
  if (r === "1W" || r === "7") return 7;
  if (r === "3M" || r === "90") return 90;
  if (r === "6M" || r === "180") return 180;
  if (r === "1Y" || r === "365") return 365;
  return 30;
}

export function formatChartLabel(ts: number, rangeDays: number): string {
  const d = new Date(ts * 1000);
  if (rangeDays <= 1) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  if (rangeDays <= 7) {
    return d.toLocaleDateString("en-US", { weekday: "short" });
  }
  if (rangeDays <= 90) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

/** Evenly sample candles for display without losing trend shape. */
export function downsampleCandles(candles: ChartCandle[], maxPoints = 120): ChartCandle[] {
  if (candles.length <= maxPoints) return candles;
  const step = candles.length / maxPoints;
  const result: ChartCandle[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(candles.length - 1, Math.floor(i * step));
    result.push(candles[idx]);
  }
  return result;
}

export function buildChartLabels(candles: ChartCandle[], rangeDays: number, maxLabels = 8): string[] {
  if (candles.length === 0) return [];
  const step = Math.max(1, Math.floor(candles.length / maxLabels));
  const labels: string[] = [];
  for (let i = 0; i < candles.length; i += step) {
    labels.push(formatChartLabel(candles[i].t, rangeDays));
  }
  return labels;
}

export type AssetChartPayload = {
  symbol: string;
  displayName: string;
  range: ChartRange;
  variant: "line" | "area";
  spot: number;
  bid: number;
  ask: number;
  change24hPct: number | null;
  high: number;
  low: number;
  marketStatus?: string;
  dataSource: "capital.com";
  fetchedAt: string;
  candleCount: number;
  candles: ChartCandle[];
};

import { buildChartQuantUi, buildComparativeChartQuantUi } from "@/lib/quant-ui/builders";

export function buildAssetPriceChartGenui(payload: AssetChartPayload) {
  const displayCandles = downsampleCandles(payload.candles, 120);
  const closes = displayCandles.map((c) => c.c);

  const change =
    payload.change24hPct != null
      ? `${payload.change24hPct >= 0 ? "+" : ""}${payload.change24hPct.toFixed(2)}%`
      : undefined;
  const trend =
    payload.change24hPct == null
      ? ("flat" as const)
      : payload.change24hPct >= 0
        ? ("up" as const)
        : ("down" as const);

  return {
    view: [
      {
        type: "component" as const,
        name: "AssetPriceChart",
        props: {
          ...payload,
          candles: displayCandles,
        },
      },
      {
        type: "keyValue" as const,
        items: [
          { label: "Spot", value: payload.spot.toLocaleString(undefined, { maximumFractionDigits: 2 }) },
          { label: "24h Change", value: change ?? "—" },
          { label: "Range High", value: payload.high.toLocaleString(undefined, { maximumFractionDigits: 2 }) },
          { label: "Range Low", value: payload.low.toLocaleString(undefined, { maximumFractionDigits: 2 }) },
          { label: "Data points", value: payload.candleCount },
        ],
      },
    ],
    metricCard: {
      type: "metricCard" as const,
      label: payload.symbol,
      value: payload.spot,
      delta: change,
      trend,
      accent: "amber" as const,
      sparkline: closes.slice(-12),
    },
  };
}

export async function fetchAssetChartData(args: {
  symbol?: string;
  query?: string;
  range?: string;
  variant?: "line" | "area";
}) {
  const lookup = args.symbol ?? args.query ?? "";
  const asset = resolveAssetSymbol(lookup);
  if (!asset) {
    return {
      success: false as const,
      error: `Could not resolve asset for "${lookup}". Try a ticker like BTCUSD, AAPL, or GOLD.`,
    };
  }

  const range = ((args.range ?? "1M").toUpperCase() as ChartRange) || "1M";
  const rangeDays = rangeToDays(range);
  const assetClass = asset.asset_class ?? "";

  try {
    const [quote, candles] = await Promise.all([
      capitalAdapter.fetchQuoteStrict(asset.symbol, assetClass),
      capitalAdapter.fetchCandlesStrict(asset.symbol, assetClass, rangeDays),
    ]);

    const chartCandles: ChartCandle[] = candles.map((c: CapitalCandle) => ({
      t: c.t,
      o: c.o,
      h: c.h,
      l: c.l,
      c: c.c,
    }));

    const high = Math.max(...chartCandles.map((c) => c.h));
    const low = Math.min(...chartCandles.map((c) => c.l));

    const payload: AssetChartPayload = {
      symbol: asset.symbol,
      displayName: asset.display_name,
      range,
      variant: args.variant ?? "area",
      spot: quote.spot,
      bid: quote.bid,
      ask: quote.ask,
      change24hPct: quote.change24hPct,
      high,
      low,
      marketStatus: quote.marketStatus,
      dataSource: "capital.com",
      fetchedAt: new Date().toISOString(),
      candleCount: chartCandles.length,
      candles: chartCandles,
    };

    const chartGenui = buildAssetPriceChartGenui(payload);
    const quant_ui = buildChartQuantUi(payload);

    return {
      success: true as const,
      symbol: asset.symbol,
      display_name: asset.display_name,
      asset_class: asset.asset_class,
      sector: asset.sector,
      range,
      quote: {
        spot: quote.spot,
        bid: quote.bid,
        ask: quote.ask,
        change24hPct: quote.change24hPct,
      },
      stats: { high, low, points: chartCandles.length },
      data_source: "capital.com" as const,
      candles: chartCandles,
      /** Server-built chart — inject directly, never rewrite numbers. */
      genui: { view: chartGenui.view },
      quant_ui,
      chart_props: payload,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false as const,
      symbol: asset.symbol,
      error: `Live market data unavailable: ${message}`,
    };
  }
}

export async function fetchComparativeChartData(args: {
  symbol1: string;
  symbol2: string;
  range?: string;
}) {
  const [a, b] = await Promise.all([
    fetchAssetChartData({ symbol: args.symbol1, range: args.range ?? "6M" }),
    fetchAssetChartData({ symbol: args.symbol2, range: args.range ?? "6M" }),
  ]);

  if (!a.success || !b.success) {
    return {
      success: false as const,
      error: a.success ? b.error : a.error,
    };
  }

  const len = Math.min(a.candles.length, b.candles.length);
  const aSlice = a.candles.slice(-len);
  const bSlice = b.candles.slice(-len);
  const rangeDays = rangeToDays(args.range ?? "6M");

  const data = aSlice.map((c, i) => ({
    time: formatChartLabel(c.t, rangeDays),
    val1: c.c,
    val2: bSlice[i]?.c ?? c.c,
  }));

  return {
    success: true as const,
    range: args.range ?? "6M",
    data_source: "capital.com" as const,
    quant_ui: buildComparativeChartQuantUi({
      symbol1: a.symbol!,
      symbol2: b.symbol!,
      name1: a.display_name!,
      name2: b.display_name!,
      range: args.range ?? "6M",
    }),
    genui: {
      view: [
        {
          type: "component" as const,
          name: "AssetComparativeChart",
          props: {
            ticker1: a.symbol,
            ticker2: b.symbol,
            range: args.range ?? "6M",
            data,
            dataSource: "capital.com",
          },
        },
      ],
    },
  };
}
