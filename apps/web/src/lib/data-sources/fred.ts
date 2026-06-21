const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

export async function fetchFredLatest(seriesId: string): Promise<number | null> {
  const apiKey = process.env.FRED_API_KEY?.trim();
  if (!apiKey) return null;

  const url = new URL(FRED_BASE);
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    observations?: Array<{ value?: string }>;
  };
  const value = Number(json.observations?.[0]?.value);
  return Number.isFinite(value) ? value : null;
}

export async function fetchMacroSnapshot() {
  const [fedFunds, cpi, unemployment, vixProxy] = await Promise.all([
    fetchFredLatest("FEDFUNDS"),
    fetchFredLatest("CPIAUCSL"),
    fetchFredLatest("UNRATE"),
    fetchFredLatest("VIXCLS"),
  ]);

  return {
    fed_funds_rate: fedFunds,
    cpi_index: cpi,
    unemployment_rate: unemployment,
    vix: vixProxy,
    source: process.env.FRED_API_KEY ? "fred" : "unavailable",
  };
}
