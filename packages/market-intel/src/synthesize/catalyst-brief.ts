import type { NormalizedIntelDoc } from "../enrich/normalizer.js";
import { persistSynthesisBrief } from "../persist-synthesis.js";
import { persistSignal } from "../persist.js";

export type CatalystBriefInput = {
  symbol: string;
  documents: NormalizedIntelDoc[];
  change24h?: number;
  regime?: string;
  scanRunId?: string;
};

function sentimentLabel(score: number): "bullish" | "bearish" | "neutral" {
  if (score > 0.15) return "bullish";
  if (score < -0.15) return "bearish";
  return "neutral";
}

export async function synthesizeCatalystBrief(input: CatalystBriefInput) {
  const { symbol, documents, change24h, regime, scanRunId } = input;
  if (documents.length === 0) return null;

  const sentiments = documents.map((d) => d.sentiment ?? 0).filter((s) => !Number.isNaN(s));
  const avgSentiment =
    sentiments.length > 0 ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length : 0;
  const bias = sentimentLabel(avgSentiment);

  const topDoc = documents[0];
  const provenance = documents.slice(0, 5).map((d) => ({
    source: d.source,
    url: d.url,
    title: d.title,
    excerpt: d.body.slice(0, 200)
  }));

  const moveStr =
    change24h != null ?
      `${change24h >= 0 ? "up" : "down"} ${Math.abs(change24h).toFixed(2)}%`
    : "moving on fresh headlines";

  const headline = `${symbol} is ${moveStr} — ${bias} catalyst from ${documents.length} fresh source${documents.length > 1 ? "s" : ""}`;
  const thesis = `${symbol} shows ${bias} sentiment (${avgSentiment >= 0 ? "+" : ""}${avgSentiment.toFixed(2)}) across recent headlines. Key driver: "${topDoc.title}".${regime ? ` Macro regime: ${regime.replace(/_/g, " ")}.` : ""}`;

  const bullets = {
    bullish: bias === "bullish" ? documents.slice(0, 3).map((d) => d.title) : [],
    bearish: bias === "bearish" ? documents.slice(0, 3).map((d) => d.title) : [],
    actionable: [
      `Monitor ${symbol} for continuation if sentiment holds`,
      topDoc.eventType ? `Event type: ${topDoc.eventType.replace(/_/g, " ")}` : "Watch next headline cluster"
    ]
  };

  const impactScore = Math.min(
    10,
    Math.max(3, Math.round(Math.abs(avgSentiment) * 10 + documents.length))
  );
  const confidence = Math.min(0.95, 0.45 + documents.length * 0.08 + (provenance.filter((p) => p.url).length > 0 ? 0.15 : 0));

  const brief = await persistSynthesisBrief({
    briefType: "catalyst",
    symbols: [symbol],
    headline,
    thesis,
    bullets,
    impactScore,
    confidence,
    provenance,
    regime,
    expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
    scanRunId
  });

  if (scanRunId) {
    await persistSignal({
      symbol,
      strategy: "AI_CATALYST",
      action: bias === "bullish" ? "BUY" : bias === "bearish" ? "SELL" : "WATCH",
      timeframe: "1H",
      confidence,
      reason: headline,
      source: "ai",
      payload: { synthesisBriefId: brief.id, impactScore },
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      scanRunId
    }).catch(() => {});
  }

  return brief;
}

export async function synthesizeMorningBrief(symbols: string[], scanRunId?: string) {
  const { prisma } = await import("@quant/db");
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const briefs = await prisma.synthesisBrief.findMany({
    where: { briefType: "catalyst", createdAt: { gte: since } },
    orderBy: { impactScore: "desc" },
    take: 8
  });

  const top = briefs.filter((b) => symbols.length === 0 || b.symbols.some((s) => symbols.includes(s)));
  if (top.length === 0) return null;

  const headline = `Morning brief: ${top.length} high-impact catalysts across markets`;
  const thesis = top.map((b) => `• ${b.headline}`).join(" ");

  return persistSynthesisBrief({
    briefType: "morning",
    symbols: [...new Set(top.flatMap((b) => b.symbols))],
    headline,
    thesis,
    bullets: {
      actionable: top.slice(0, 5).map((b) => b.headline)
    },
    impactScore: Math.max(...top.map((b) => b.impactScore)),
    confidence: 0.7,
    provenance: top.flatMap((b) => (b.provenance as Array<{ source: string; url?: string }>) ?? []).slice(0, 5),
    expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
    scanRunId
  });
}
