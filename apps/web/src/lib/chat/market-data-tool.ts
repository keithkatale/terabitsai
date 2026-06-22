import { fetchAssetChartData, fetchComparativeChartData } from "@/lib/chat/chart-data-tool";
import { buildMarketOverviewQuantUi } from "@/lib/quant-ui/builders";

export { fetchAssetChartData, fetchComparativeChartData, rangeToDays } from "@/lib/chat/chart-data-tool";

/** @deprecated Use fetchAssetChartData — kept for backward compatibility. */
export async function fetchAssetMarketData(args: {
  symbol?: string;
  query?: string;
  range?: string;
}) {
  return fetchAssetChartData({ ...args, variant: "area" });
}

const OVERVIEW_FALLBACK = ["BTCUSD", "ETHUSD", "US100", "GOLD", "AAPL"];

export async function fetchMarketOverview(symbols?: string[]) {
  const list = (symbols?.length ? symbols : OVERVIEW_FALLBACK).slice(0, 6);
  const results = await Promise.all(
    list.map((symbol) => fetchAssetChartData({ symbol, range: "1M" })),
  );

  const assets = results
    .filter((r) => r.success && r.quote)
    .map((r) => ({
      symbol: r.symbol!,
      displayName: r.display_name ?? r.symbol!,
      spot: r.quote!.spot,
      change24hPct: r.quote!.change24hPct,
      range: r.range ?? "1M",
    }));

  if (assets.length === 0) {
    return { success: false as const, error: "Could not load live market overview data." };
  }

  const quant_ui = buildMarketOverviewQuantUi(assets);

  return {
    success: true as const,
    symbols: assets.map((a) => a.symbol),
    assets,
    data_source: "capital.com" as const,
    quant_ui,
  };
}
