export type FinnhubSentimentArticle = {
  headline: string;
  url?: string;
  source: string;
  summary: string;
  datetime: number;
  id?: number;
};

export async function fetchFinnhubNewsSentiment(symbol: string): Promise<{
  articles: FinnhubSentimentArticle[];
  buzz?: { articlesInLastWeek?: number; buzz?: number };
  sentiment?: { bearishPercent?: number; bullishPercent?: number };
}> {
  const key = process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
  if (!key) return { articles: [] };

  try {
    const url = `https://finnhub.io/api/v1/news-sentiment?symbol=${encodeURIComponent(symbol)}&token=${key}`;
    const res = await fetch(url);
    if (!res.ok) return { articles: [] };
    const data = (await res.json()) as {
      buzz?: { articlesInLastWeek?: number; buzz?: number };
      sentiment?: { bearishPercent?: number; bullishPercent?: number };
      news?: FinnhubSentimentArticle[];
    };
    return {
      articles: data.news ?? [],
      buzz: data.buzz,
      sentiment: data.sentiment
    };
  } catch {
    return { articles: [] };
  }
}

export type EarningsCalendarEvent = {
  symbol: string;
  date: string;
  epsEstimate?: number;
  quarter?: number;
  year?: number;
  hour?: string;
};

export async function fetchFinnhubEarningsCalendar(
  from: string,
  to: string
): Promise<EarningsCalendarEvent[]> {
  const key = process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
  if (!key) return [];

  try {
    const url = `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${key}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { earningsCalendar?: EarningsCalendarEvent[] };
    return data.earningsCalendar ?? [];
  } catch {
    return [];
  }
}

export async function fetchFinnhubEconomicCalendar(
  from: string,
  to: string
): Promise<
  Array<{ country?: string; event?: string; time?: string; impact?: string; estimate?: number; actual?: number }>
> {
  const key = process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
  if (!key) return [];

  try {
    const url = `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${key}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { economicCalendar?: Array<Record<string, unknown>> };
    return (data.economicCalendar ?? []) as Array<{
      country?: string;
      event?: string;
      time?: string;
      impact?: string;
    }>;
  } catch {
    return [];
  }
}

export async function fetchFinnhubInsiderSentiment(symbol: string): Promise<{
  data?: Array<{ year: number; month: number; change: number; mspr: number }>;
}> {
  const key = process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
  if (!key) return {};

  try {
    const url = `https://finnhub.io/api/v1/stock/insider-sentiment?symbol=${encodeURIComponent(symbol)}&token=${key}`;
    const res = await fetch(url);
    if (!res.ok) return {};
    return (await res.json()) as { data?: Array<{ year: number; month: number; change: number; mspr: number }> };
  } catch {
    return {};
  }
}
