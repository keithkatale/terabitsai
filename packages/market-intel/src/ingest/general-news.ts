export type GeneralHeadline = {
  title: string;
  summary: string;
  source: string;
  url?: string;
  publishedAt?: Date;
  category?: string;
  symbols?: string[];
};

const YAHOO_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";

export async function fetchYahooTopicNews(query: string, newsCount = 8): Promise<GeneralHeadline[]> {
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=${newsCount}`;
    const res = await fetch(url, { headers: { "User-Agent": YAHOO_UA } });
    if (!res.ok) return [];
    const data = (await res.json()) as { news?: Array<Record<string, unknown>> };
    return (data.news ?? []).map((art) => ({
      title: String(art.title ?? ""),
      summary: String(art.title ?? ""),
      source: String(art.publisher ?? "Yahoo Finance"),
      url: art.link ? String(art.link) : undefined,
      publishedAt: art.providerPublishTime
        ? new Date(Number(art.providerPublishTime) * 1000)
        : undefined,
      category: query,
    }));
  } catch {
    return [];
  }
}

export async function fetchFinnhubCategoryNews(
  category: "general" | "forex" | "crypto" | "merger" = "general",
): Promise<GeneralHeadline[]> {
  const key = process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
  if (!key) return [];

  try {
    const url = `https://finnhub.io/api/v1/news?category=${category}&token=${key}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const articles = (await res.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(articles)) return [];
    return articles.slice(0, 15).map((art) => ({
      title: String(art.headline ?? ""),
      summary: String(art.summary ?? art.headline ?? ""),
      source: String(art.source ?? "Finnhub"),
      url: art.url ? String(art.url) : undefined,
      publishedAt: art.datetime ? new Date(Number(art.datetime) * 1000) : undefined,
      category,
      symbols: art.related ? String(art.related).split(",").map((s) => s.trim()).filter(Boolean) : [],
    }));
  } catch {
    return [];
  }
}

/** Free Google News RSS (no API key). */
export async function fetchGoogleNewsRss(query: string): Promise<GeneralHeadline[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetch(url, { headers: { "User-Agent": YAHOO_UA } });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    return items.slice(0, 12).map((match) => {
      const block = match[1];
      const title = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
        ?? block.match(/<title>(.*?)<\/title>/)?.[1]
        ?? "";
      const link = block.match(/<link>(.*?)<\/link>/)?.[1] ?? undefined;
      const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1];
      const source = block.match(/<source[^>]*>(.*?)<\/source>/)?.[1] ?? "Google News";
      return {
        title: title.replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim(),
        summary: title.trim(),
        source,
        url: link,
        publishedAt: pubDate ? new Date(pubDate) : undefined,
        category: query,
      };
    }).filter((h) => h.title.length > 0);
  } catch {
    return [];
  }
}

export const MACRO_NEWS_QUERIES = [
  "stock market today",
  "Federal Reserve interest rates",
  "inflation economy",
  "Bitcoin cryptocurrency",
  "AI technology stocks",
  "oil gold commodities",
] as const;

export async function fetchMacroNewsBundle(): Promise<GeneralHeadline[]> {
  const [finnhubGeneral, finnhubCrypto, ...topicResults] = await Promise.all([
    fetchFinnhubCategoryNews("general"),
    fetchFinnhubCategoryNews("crypto"),
    ...MACRO_NEWS_QUERIES.slice(0, 3).map((q) => fetchGoogleNewsRss(q)),
    ...MACRO_NEWS_QUERIES.slice(0, 2).map((q) => fetchYahooTopicNews(q, 5)),
  ]);

  const seen = new Set<string>();
  const merged: GeneralHeadline[] = [];
  for (const list of [finnhubGeneral, finnhubCrypto, ...topicResults]) {
    for (const item of list) {
      const key = item.title.toLowerCase().slice(0, 120);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }
  return merged;
}
