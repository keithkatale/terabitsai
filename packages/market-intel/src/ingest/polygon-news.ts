/** Optional Polygon.io + Benzinga news (Phase C) */
export async function fetchPolygonBenzingaNews(symbol: string): Promise<
  Array<{ title: string; body: string; url?: string; publishedAt?: Date }>
> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return [];

  try {
    const url = `https://api.polygon.io/v2/reference/news?ticker=${encodeURIComponent(symbol)}&limit=5&apiKey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{ title?: string; description?: string; article_url?: string; published_utc?: string }>;
    };
    return (data.results ?? []).map((r) => ({
      title: r.title ?? "",
      body: r.description ?? r.title ?? "",
      url: r.article_url,
      publishedAt: r.published_utc ? new Date(r.published_utc) : undefined
    }));
  } catch {
    return [];
  }
}
