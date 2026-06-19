import { prisma } from "@quant/db";
import type { SynthesisBrief, CatalystRadarItem, IntelDocument } from "@quant/contracts";

function iso(d: Date): string {
  return d.toISOString();
}

export async function fetchSynthesisBriefs(opts: {
  briefType?: string;
  symbol?: string;
  limit?: number;
}): Promise<SynthesisBrief[]> {
  const limit = opts.limit ?? 20;
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const rows = await prisma.synthesisBrief.findMany({
    where: {
      createdAt: { gte: since },
      ...(opts.briefType ? { briefType: opts.briefType } : {}),
      ...(opts.symbol ? { symbols: { has: opts.symbol } } : {}),
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
    },
    orderBy: { createdAt: "desc" },
    take: limit
  });

  return rows.map((r) => ({
    id: r.id,
    briefType: r.briefType as SynthesisBrief["briefType"],
    symbols: r.symbols,
    headline: r.headline,
    thesis: r.thesis,
    bullets: r.bullets as SynthesisBrief["bullets"],
    impactScore: r.impactScore,
    confidence: r.confidence,
    provenance: r.provenance as SynthesisBrief["provenance"],
    analogs: (r.analogs as SynthesisBrief["analogs"]) ?? null,
    regime: r.regime,
    expiresAt: r.expiresAt ? iso(r.expiresAt) : null,
    createdAt: iso(r.createdAt)
  }));
}

export async function fetchIntelDocuments(opts: {
  symbol?: string;
  diet?: string;
  limit?: number;
}): Promise<IntelDocument[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await prisma.intelDocument.findMany({
    where: {
      createdAt: { gte: since },
      ...(opts.symbol ? { OR: [{ symbol: opts.symbol }, { symbols: { has: opts.symbol } }] } : {}),
      ...(opts.diet ? { diet: opts.diet } : {})
    },
    orderBy: { publishedAt: "desc" },
    take: opts.limit ?? 30
  });

  return rows.map((r) => ({
    id: r.id,
    diet: r.diet as IntelDocument["diet"],
    source: r.source,
    externalId: r.externalId,
    symbol: r.symbol,
    symbols: r.symbols,
    title: r.title,
    body: r.body,
    url: r.url,
    sentiment: r.sentiment,
    eventType: r.eventType,
    publishedAt: r.publishedAt ? iso(r.publishedAt) : null,
    createdAt: iso(r.createdAt)
  }));
}

export async function fetchCatalystRadar(symbols: string[]): Promise<CatalystRadarItem[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const items: CatalystRadarItem[] = [];

  for (const symbol of symbols) {
    const brief = await prisma.synthesisBrief.findFirst({
      where: {
        briefType: "catalyst",
        symbols: { has: symbol },
        createdAt: { gte: since }
      },
      orderBy: { impactScore: "desc" }
    });

    const docs = await prisma.intelDocument.findMany({
      where: { symbol, diet: "catalyst", createdAt: { gte: since } },
      take: 10
    });

    const latestSignal = await prisma.marketSignal.findFirst({
      where: { symbol, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" }
    });

    const sentiments = docs.map((d) => d.sentiment ?? 0).filter((s) => !Number.isNaN(s));
    let heat =
      sentiments.length > 0 ?
        sentiments.reduce((a, b) => a + b, 0) / sentiments.length
      : brief ?
        brief.confidence - 0.5
      : latestSignal ?
        latestSignal.action === "BUY" ? 0.35 : latestSignal.action === "SELL" ? -0.35 : 0
      : 0;

    if (brief || docs.length > 0 || latestSignal) {
      items.push({
        symbol,
        heat: Math.max(-1, Math.min(1, heat)),
        impactScore: brief?.impactScore ?? Math.min(10, docs.length + (latestSignal ? 3 : 0) + 2),
        headline:
          brief?.headline ??
          docs[0]?.title ??
          latestSignal?.reason ??
          `${symbol} — monitoring`,
        briefId: brief?.id,
        sentiment: sentiments[0]
      });
    }
  }

  return items.sort((a, b) => b.impactScore - a.impactScore);
}

export async function fetchCalendarEvents(days = 7) {
  const since = new Date();
  const until = new Date();
  until.setDate(until.getDate() + days);

  return prisma.intelDocument.findMany({
    where: {
      diet: "calendar",
      publishedAt: { gte: since, lte: until }
    },
    orderBy: { publishedAt: "asc" },
    take: 50
  });
}
