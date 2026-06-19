export type NormalizedIntelDoc = {
  diet: "catalyst" | "fundamental" | "flow" | "macro" | "calendar" | "onchain";
  source: string;
  externalId?: string;
  symbol?: string;
  symbols: string[];
  title: string;
  body: string;
  url?: string;
  sentiment?: number;
  eventType?: string;
  publishedAt?: Date;
  payload?: Record<string, unknown>;
};

export function normalizeFinnhubNews(
  symbol: string,
  articles: Array<{
    headline: string;
    summary: string;
    source: string;
    url?: string;
    publishedAt?: Date;
    sentiment?: number;
    id?: string;
  }>
): NormalizedIntelDoc[] {
  return articles.map((a) => ({
    diet: "catalyst" as const,
    source: "finnhub",
    externalId: a.id ?? `${symbol}-${a.headline.slice(0, 80)}`,
    symbol,
    symbols: [symbol],
    title: a.headline,
    body: a.summary || a.headline,
    url: a.url,
    sentiment: a.sentiment,
    eventType: inferEventType(a.headline),
    publishedAt: a.publishedAt
  }));
}

export function normalizeFredSeries(
  seriesId: string,
  label: string,
  value: number,
  changePct?: number,
  date?: string
): NormalizedIntelDoc {
  const body = `${label} (${seriesId}): ${value}${changePct != null ? ` (${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}% vs prior)` : ""}`;
  return {
    diet: "macro",
    source: "fred",
    externalId: `${seriesId}-${date ?? new Date().toISOString().slice(0, 10)}`,
    symbols: [],
    title: label,
    body,
    sentiment: changePct != null ? Math.max(-1, Math.min(1, changePct / 5)) : 0,
    eventType: "macro_print",
    publishedAt: date ? new Date(date) : new Date(),
    payload: { seriesId, value, changePct }
  };
}

export function normalizeCalendarEvent(input: {
  symbol?: string;
  title: string;
  body: string;
  eventDate: Date;
  eventType: string;
  source: string;
  externalId: string;
}): NormalizedIntelDoc {
  return {
    diet: "calendar",
    source: input.source,
    externalId: input.externalId,
    symbol: input.symbol,
    symbols: input.symbol ? [input.symbol] : [],
    title: input.title,
    body: input.body,
    eventType: input.eventType,
    publishedAt: input.eventDate
  };
}

export function normalizeMarketauxArticle(article: {
  uuid?: string;
  title: string;
  description?: string;
  url?: string;
  published_at?: string;
  entities?: Array<{ symbol?: string; sentiment_score?: number }>;
  source?: string;
}): NormalizedIntelDoc {
  const symbols = (article.entities ?? [])
    .map((e) => e.symbol)
    .filter((s): s is string => Boolean(s));
  const sentiments = (article.entities ?? [])
    .map((e) => e.sentiment_score)
    .filter((s): s is number => s != null);
  const avgSentiment =
    sentiments.length > 0 ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length : undefined;

  return {
    diet: "catalyst",
    source: "marketaux",
    externalId: article.uuid ?? article.title.slice(0, 100),
    symbol: symbols[0],
    symbols,
    title: article.title,
    body: article.description ?? article.title,
    url: article.url,
    sentiment: avgSentiment,
    eventType: inferEventType(article.title),
    publishedAt: article.published_at ? new Date(article.published_at) : new Date(),
    payload: { source: article.source }
  };
}

export function normalizeFmpInsider(row: {
  symbol: string;
  transactionType?: string;
  securitiesTransacted?: number;
  price?: number;
  reportingName?: string;
  transactionDate?: string;
}): NormalizedIntelDoc {
  const isBuy = (row.transactionType ?? "").toLowerCase().includes("p-purchase");
  return {
    diet: "flow",
    source: "fmp",
    externalId: `insider-${row.symbol}-${row.transactionDate}-${row.reportingName}`,
    symbol: row.symbol,
    symbols: [row.symbol],
    title: `Insider ${isBuy ? "buy" : "sell"}: ${row.reportingName ?? "unknown"}`,
    body: `${row.reportingName} ${row.transactionType} ${row.securitiesTransacted} shares @ $${row.price}`,
    sentiment: isBuy ? 0.6 : -0.6,
    eventType: "insider_trade",
    publishedAt: row.transactionDate ? new Date(row.transactionDate) : new Date()
  };
}

export function normalizeFmpTranscript(symbol: string, quarter: string, content: string): NormalizedIntelDoc {
  return {
    diet: "fundamental",
    source: "fmp",
    externalId: `transcript-${symbol}-${quarter}`,
    symbol,
    symbols: [symbol],
    title: `${symbol} earnings call transcript ${quarter}`,
    body: content.slice(0, 8000),
    eventType: "earnings_transcript",
    publishedAt: new Date()
  };
}

function inferEventType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("earnings") || t.includes("eps")) return "earnings";
  if (t.includes("upgrade") || t.includes("downgrade")) return "analyst_rating";
  if (t.includes("fda") || t.includes("approval")) return "fda";
  if (t.includes("halt")) return "trading_halt";
  if (t.includes("fed") || t.includes("cpi") || t.includes("inflation")) return "macro_print";
  if (t.includes("merger") || t.includes("acquisition")) return "m_and_a";
  return "headline";
}
