const BASE = "https://www.alphavantage.co/query";

function apiKey() {
  return process.env.ALPHA_VANTAGE_API_KEY?.trim() ?? "";
}

export async function fetchAlphaVantageOverview(symbol: string) {
  const key = apiKey();
  if (!key) {
    return { success: false, error: "ALPHA_VANTAGE_API_KEY not configured" };
  }

  const url = new URL(BASE);
  url.searchParams.set("function", "OVERVIEW");
  url.searchParams.set("symbol", symbol.toUpperCase());
  url.searchParams.set("apikey", key);

  const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
  if (!res.ok) return { success: false, error: `Alpha Vantage HTTP ${res.status}` };

  const json = (await res.json()) as Record<string, string>;
  if (!json.Symbol) return { success: false, error: "Symbol not found" };

  return {
    success: true,
    symbol: json.Symbol,
    name: json.Name,
    sector: json.Sector,
    industry: json.Industry,
    market_cap: json.MarketCapitalization,
    pe_ratio: json.PERatio,
    eps: json.EPS,
    dividend_yield: json.DividendYield,
    fifty_two_week_high: json["52WeekHigh"],
    fifty_two_week_low: json["52WeekLow"],
  };
}

export async function fetchAlphaVantageNewsSentiment(tickers: string) {
  const key = apiKey();
  if (!key) {
    return { success: false, error: "ALPHA_VANTAGE_API_KEY not configured" };
  }

  const url = new URL(BASE);
  url.searchParams.set("function", "NEWS_SENTIMENT");
  url.searchParams.set("tickers", tickers.toUpperCase());
  url.searchParams.set("limit", "5");
  url.searchParams.set("apikey", key);

  const res = await fetch(url.toString(), { next: { revalidate: 900 } });
  if (!res.ok) return { success: false, error: `Alpha Vantage HTTP ${res.status}` };

  const json = (await res.json()) as { feed?: unknown[] };
  return { success: true, feed: json.feed ?? [] };
}
