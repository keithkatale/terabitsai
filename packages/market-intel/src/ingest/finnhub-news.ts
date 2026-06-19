export type FinnhubHeadline = {
  headline: string;
  summary: string;
  source: string;
  url?: string;
  publishedAt?: Date;
};

export async function fetchFinnhubNews(
  symbol: string,
  apiKey?: string
): Promise<FinnhubHeadline[]> {
  const key = apiKey ?? process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
  if (!key) return [];

  try {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 7);
    const pad = (n: number) => String(n).padStart(2, "0");
    const toStr = `${toDate.getFullYear()}-${pad(toDate.getMonth() + 1)}-${pad(toDate.getDate())}`;
    const fromStr = `${fromDate.getFullYear()}-${pad(fromDate.getMonth() + 1)}-${pad(fromDate.getDate())}`;
    const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fromStr}&to=${toStr}&token=${key}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const articles = (await res.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(articles)) return [];
    return articles.slice(0, 5).map((art) => ({
      headline: String(art.headline ?? ""),
      summary: String(art.summary ?? ""),
      source: String(art.source ?? "Finnhub"),
      url: art.url ? String(art.url) : undefined,
      publishedAt: art.datetime ? new Date(Number(art.datetime) * 1000) : undefined
    }));
  } catch {
    return [];
  }
}
