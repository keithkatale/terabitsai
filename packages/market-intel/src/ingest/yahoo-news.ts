export type YahooHeadline = {
  title: string;
  publisher: string;
  url?: string;
  publishedAt?: Date;
};

export async function fetchYahooFinanceNews(symbol: string): Promise<YahooHeadline[]> {
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&newsCount=5`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { news?: Array<Record<string, unknown>> };
    return (data.news ?? []).map((art) => ({
      title: String(art.title ?? ""),
      publisher: String(art.publisher ?? "Yahoo Finance"),
      url: art.link ? String(art.link) : undefined,
      publishedAt: art.providerPublishTime
        ? new Date(Number(art.providerPublishTime) * 1000)
        : undefined
    }));
  } catch {
    return [];
  }
}
