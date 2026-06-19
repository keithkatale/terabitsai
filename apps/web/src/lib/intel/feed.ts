import { prisma } from "@quant/db";
import type { IntelFeedItem } from "@quant/contracts";

function iso(d: Date): string {
  return d.toISOString();
}

function serializeSignal(s: {
  id: string;
  symbol: string;
  strategy: string;
  action: string;
  timeframe: string;
  confidence: number;
  reason: string;
  source: string;
  payload: unknown;
  sector: string | null;
  assetClass: string | null;
  expiresAt: Date | null;
  scanRunId: string | null;
  createdAt: Date;
}): IntelFeedItem {
  return {
    kind: "signal",
    at: iso(s.createdAt),
    item: {
      id: s.id,
      symbol: s.symbol,
      strategy: s.strategy,
      action: s.action as "BUY" | "SELL" | "WATCH",
      timeframe: s.timeframe,
      confidence: s.confidence,
      reason: s.reason,
      source: s.source as "deterministic" | "ai" | "news",
      payload: (s.payload as Record<string, unknown>) ?? null,
      sector: s.sector,
      assetClass: s.assetClass,
      expiresAt: s.expiresAt ? iso(s.expiresAt) : null,
      scanRunId: s.scanRunId,
      createdAt: iso(s.createdAt)
    }
  };
}

function serializeNews(n: {
  id: string;
  symbol: string | null;
  headline: string;
  summary: string;
  sentiment: string;
  source: string;
  url: string | null;
  category: string | null;
  publishedAt: Date | null;
  scanRunId: string | null;
  createdAt: Date;
}): IntelFeedItem {
  return {
    kind: "news",
    at: iso(n.createdAt),
    item: {
      id: n.id,
      symbol: n.symbol,
      headline: n.headline,
      summary: n.summary,
      sentiment: n.sentiment as "bullish" | "bearish" | "neutral",
      source: n.source,
      url: n.url,
      category: n.category,
      publishedAt: n.publishedAt ? iso(n.publishedAt) : null,
      scanRunId: n.scanRunId,
      createdAt: iso(n.createdAt)
    }
  };
}

function serializeOpportunity(o: {
  id: string;
  title: string;
  thesis: string;
  symbols: string[];
  horizon: string;
  conviction: number;
  style: string;
  sector: string | null;
  payload: unknown;
  expiresAt: Date | null;
  scanRunId: string | null;
  createdAt: Date;
}): IntelFeedItem {
  return {
    kind: "opportunity",
    at: iso(o.createdAt),
    item: {
      id: o.id,
      title: o.title,
      thesis: o.thesis,
      symbols: o.symbols,
      horizon: o.horizon as "intraday" | "swing" | "position",
      conviction: o.conviction as 1 | 2 | 3 | 4 | 5,
      style: o.style as "growth" | "value" | "income" | "thematic",
      sector: o.sector,
      payload: (o.payload as Record<string, unknown>) ?? null,
      expiresAt: o.expiresAt ? iso(o.expiresAt) : null,
      scanRunId: o.scanRunId,
      createdAt: iso(o.createdAt)
    }
  };
}

export async function fetchIntelFeed(opts: {
  limit?: number;
  tab?: string | null;
  sector?: string | null;
  symbol?: string | null;
  since?: Date | null;
}): Promise<IntelFeedItem[]> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const since = opts.since ?? new Date(Date.now() - 48 * 60 * 60 * 1000);
  const symbol = opts.symbol?.toUpperCase();
  const sector = opts.sector;
  const tab = opts.tab;

  const signalWhere = {
    createdAt: { gte: since },
    ...(symbol ? { symbol } : {}),
    ...(sector ? { sector } : {})
  };

  const newsWhere = {
    createdAt: { gte: since },
    ...(symbol ? { symbol } : {})
  };

  const oppWhere = {
    createdAt: { gte: since },
    ...(sector ? { sector } : {}),
    ...(symbol ? { symbols: { has: symbol } } : {})
  };

  const perKind = Math.ceil(limit / 3);

  const [signals, news, opportunities] = await Promise.all([
    tab === "news" || tab === "investing"
      ? []
      : prisma.marketSignal.findMany({
          where: signalWhere,
          orderBy: { createdAt: "desc" },
          take: tab === "trading" ? limit : perKind
        }),
    tab === "trading" || tab === "investing"
      ? []
      : prisma.marketNewsItem.findMany({
          where: newsWhere,
          orderBy: { createdAt: "desc" },
          take: tab === "news" ? limit : perKind
        }),
    tab === "trading" || tab === "news"
      ? []
      : prisma.investOpportunity.findMany({
          where: oppWhere,
          orderBy: { createdAt: "desc" },
          take: tab === "investing" ? limit : perKind
        })
  ]);

  const items: IntelFeedItem[] = [
    ...signals.map(serializeSignal),
    ...news.map(serializeNews),
    ...opportunities.map(serializeOpportunity)
  ];

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return items.slice(0, limit);
}

export async function fetchLatestPulse() {
  const pulse = await prisma.marketPulseSnapshot.findFirst({
    orderBy: { createdAt: "desc" }
  });
  if (!pulse) return null;
  const themes = pulse.themes as Array<{ label: string; value: string }>;
  return { id: pulse.id, themes, createdAt: iso(pulse.createdAt) };
}
