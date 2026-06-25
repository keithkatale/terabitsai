import { fetchAlphaVantageNewsSentiment, fetchAlphaVantageOverview } from "@/lib/data-sources/alpha-vantage";
import { fetchFearGreedIndex } from "@/lib/data-sources/fear-greed";
import { fetchMacroSnapshot } from "@/lib/data-sources/fred";
import { buildMacroDataGenui } from "@/lib/genui/macro-genui";

export async function fetchMacroData(indicators?: string[]) {
  const requested = (indicators ?? ["fear_greed", "macro"]).map((i) => i.toLowerCase());
  const result: Record<string, unknown> = { success: true };

  if (requested.includes("fear_greed") || requested.includes("sentiment")) {
    result.fear_greed = await fetchFearGreedIndex();
  }

  if (
    requested.includes("macro") ||
    requested.includes("rates") ||
    requested.includes("vix")
  ) {
    result.macro = await fetchMacroSnapshot();
  }

  const genui = buildMacroDataGenui(result);
  return genui ? { ...result, genui } : result;
}

export async function fetchFundamentals(symbol: string) {
  const sym = symbol.toUpperCase();
  const [overview, news] = await Promise.all([
    fetchAlphaVantageOverview(sym),
    fetchAlphaVantageNewsSentiment(sym),
  ]);

  return {
    success: overview.success || news.success,
    symbol: sym,
    overview,
    news_sentiment: news,
  };
}
