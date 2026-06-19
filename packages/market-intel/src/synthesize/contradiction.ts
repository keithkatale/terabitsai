import { prisma } from "@quant/db";
import { persistContradiction } from "../persist-synthesis.js";
import { persistSynthesisBrief } from "../persist-synthesis.js";

export async function detectContradictions(symbol: string, scanRunId?: string) {
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000);

  const [newsDocs, flowDocs, signals] = await Promise.all([
    prisma.intelDocument.findMany({
      where: { symbol, diet: "catalyst", createdAt: { gte: since } },
      take: 10
    }),
    prisma.intelDocument.findMany({
      where: { symbol, diet: "flow", createdAt: { gte: since } },
      take: 10
    }),
    prisma.marketSignal.findMany({
      where: { symbol, createdAt: { gte: since }, strategy: { in: ["RSI_FADE", "EMA_CROSS", "MACD_CROSS", "SMC_ORDER_BLOCK"] } },
      take: 5
    })
  ]);

  const newsAvg =
    newsDocs.length ?
      newsDocs.reduce((s, d) => s + (d.sentiment ?? 0), 0) / newsDocs.length
    : 0;
  const flowAvg =
    flowDocs.length ?
      flowDocs.reduce((s, d) => s + (d.sentiment ?? 0), 0) / flowDocs.length
    : 0;

  const newsBias = newsAvg > 0.1 ? "bullish" : newsAvg < -0.1 ? "bearish" : "neutral";
  const flowBias = flowAvg > 0.1 ? "bullish" : flowAvg < -0.1 ? "bearish" : "neutral";

  const techBias =
    signals.find((s) => s.action === "SELL") ? "bearish"
    : signals.find((s) => s.action === "BUY") ? "bullish"
    : "neutral";

  const contradictions: string[] = [];
  if (newsBias === "bullish" && flowBias === "bearish") contradictions.push("news vs flow");
  if (newsBias === "bullish" && techBias === "bearish") contradictions.push("news vs technicals");
  if (newsBias === "bearish" && techBias === "bullish") contradictions.push("news vs technicals");

  if (contradictions.length === 0) return null;

  const summary = `${symbol}: ${contradictions.join(", ")} disagreement — news ${newsBias}, flow ${flowBias}, technicals ${techBias}`;
  const alert = await persistContradiction({
    symbol,
    newsBias,
    flowBias,
    technicalBias: techBias,
    summary,
    severity: 7,
    payload: { contradictions }
  });

  await persistSynthesisBrief({
    briefType: "contradiction",
    symbols: [symbol],
    headline: `Contradiction alert: ${symbol}`,
    thesis: summary,
    bullets: {
      actionable: ["Treat signals with lower conviction until alignment returns"]
    },
    impactScore: 8,
    confidence: 0.7,
    provenance: newsDocs.slice(0, 2).map((d) => ({ source: d.source, url: d.url ?? undefined, title: d.title })),
    scanRunId
  });

  return alert;
}
