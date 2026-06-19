export type MarketauxArticle = {
  uuid?: string;
  title: string;
  description?: string;
  url?: string;
  published_at?: string;
  source?: string;
  entities?: Array<{ symbol?: string; name?: string; sentiment_score?: number }>;
};

export async function fetchMarketauxNews(opts: {
  symbols?: string[];
  limit?: number;
}): Promise<MarketauxArticle[]> {
  const apiKey = process.env.MARKETAUX_API_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    api_token: apiKey,
    language: "en",
    limit: String(opts.limit ?? 10)
  });
  if (opts.symbols?.length) {
    params.set("symbols", opts.symbols.join(","));
  }

  try {
    const url = `https://api.marketaux.com/v1/news/all?${params}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: MarketauxArticle[] };
    return data.data ?? [];
  } catch {
    return [];
  }
}
