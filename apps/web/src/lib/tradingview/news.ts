import { tradingViewAuthHint, tradingViewFetch } from "./client";

const NEWS_BASE = "https://news-headlines.tradingview.com/v2";

export type TvNewsHeadline = {
  id: string | null;
  published: string | null;
  provider: string;
  title: string;
  urgency: unknown;
  related_symbols: string;
  link: string;
};

function epochToIso(epoch: unknown): string | null {
  if (epoch == null) return null;
  const n = Number(epoch);
  if (!Number.isFinite(n)) return null;
  return new Date(n * 1000).toISOString();
}

export function normalizeHeadline(item: Record<string, unknown>): TvNewsHeadline {
  const related = Array.isArray(item.relatedSymbols)
    ? (item.relatedSymbols as unknown[])
        .slice(0, 6)
        .map((s) => (typeof s === "string" ? s : (s as { symbol?: string })?.symbol ?? ""))
        .filter(Boolean)
        .join(",")
    : "";
  const link = item.link
    ? String(item.link)
    : item.storyPath
      ? `https://www.tradingview.com${item.storyPath}`
      : "";

  return {
    id: (item.id as string) ?? null,
    published: epochToIso(item.published),
    provider: String(item.source ?? item.provider ?? ""),
    title: String(item.title ?? ""),
    urgency: item.urgency ?? null,
    related_symbols: related,
    link,
  };
}

export async function fetchTradingViewNews(opts: {
  symbol?: string;
  category?: string;
  limit?: number;
  lang?: string;
}) {
  const params = new URLSearchParams();
  params.set("client", "web");
  params.set("lang", opts.lang ?? "en");
  params.set("streaming", "false");
  if (opts.category) params.set("category", opts.category);
  if (opts.symbol) params.set("symbol", opts.symbol);

  const url = `${NEWS_BASE}/headlines?${params.toString()}`;
  const res = await tradingViewFetch(url);
  if (!res.ok) {
    const text = await res.text();
    const hint = res.status === 401 || res.status === 403 ? ` ${tradingViewAuthHint()}` : "";
    throw new Error(`TradingView news ${res.status}: ${text.slice(0, 200)}.${hint}`);
  }

  const payload = (await res.json()) as { items?: Record<string, unknown>[] };
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const limit = Math.max(1, opts.limit ?? 25);
  return {
    success: true as const,
    headlines: items.slice(0, limit).map((it) => normalizeHeadline(it)),
  };
}

export async function fetchTradingViewSymbolSearch(opts: {
  query: string;
  type?: string;
  exchange?: string;
  limit?: number;
}) {
  const params = new URLSearchParams();
  params.set("text", opts.query);
  params.set("hl", "1");
  params.set("lang", "en");
  params.set("search_type", opts.type ?? "");
  params.set("domain", "production");
  params.set("start", "0");
  if (opts.exchange) params.set("exchange", opts.exchange);

  const url = `https://symbol-search.tradingview.com/symbol_search/v3/?${params.toString()}`;
  const res = await tradingViewFetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TradingView search ${res.status}: ${text.slice(0, 200)}`);
  }

  const payload = (await res.json()) as { symbols?: Record<string, unknown>[] };
  const symbols = Array.isArray(payload?.symbols) ? payload.symbols : [];
  const limit = Math.max(1, opts.limit ?? 20);

  const results = symbols.slice(0, limit).map((item) => {
    const exchange = String(item.exchange ?? item.prefix ?? "");
    const sym = String(item.symbol ?? "").replace(/<\/?em>/g, "");
    return {
      symbol: exchange && sym ? `${exchange}:${sym}` : sym,
      description: String(item.description ?? "").replace(/<\/?em>/g, ""),
      type: String(item.type ?? ""),
      exchange,
      country: String(item.country ?? ""),
      currency: String(item.currency_code ?? item.currency ?? ""),
    };
  });

  return { success: true as const, results };
}
