import { prisma } from "@quant/db";
import { embedText, cosineSimilarity } from "../enrich/embedder.js";
import { persistHistoricalAnalog } from "../persist-synthesis.js";

export async function recordAnalog(input: {
  symbol: string;
  eventSummary: string;
  documentId?: string;
  synthesisId?: string;
  return1h?: number;
  return1d?: number;
  return1w?: number;
}) {
  const { vector } = await embedText(input.eventSummary);
  return persistHistoricalAnalog(input);
}

export async function findHistoricalAnalogs(eventSummary: string, symbol?: string, limit = 5) {
  const { vector } = await embedText(eventSummary);
  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const rows = await prisma.historicalAnalog.findMany({
    where: {
      createdAt: { gte: since },
      ...(symbol ? { symbol } : {})
    },
    take: 100,
    orderBy: { createdAt: "desc" }
  });

  const scored = rows
    .map((r) => {
      const emb = r.contextEmbedding as number[] | null;
      const sim = emb?.length ? cosineSimilarity(vector, emb) : 0;
      return { row: r, sim };
    })
    .filter((x) => x.sim > 0.1)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, limit);

  return scored.map(({ row, sim }) => ({
    summary: row.eventSummary,
    symbol: row.symbol,
    return1d: row.return1d,
    return1w: row.return1w,
    similarity: sim
  }));
}

export async function buildConvictionScores(symbols: string[]) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const results = [];

  for (const symbol of symbols) {
    const [briefs, signals, contradictions] = await Promise.all([
      prisma.synthesisBrief.findMany({
        where: { symbols: { has: symbol }, createdAt: { gte: since } }
      }),
      prisma.marketSignal.findMany({
        where: { symbol, createdAt: { gte: since } }
      }),
      prisma.contradictionAlert.findMany({
        where: { symbol, createdAt: { gte: since } }
      })
    ]);

    const diets: Record<string, number> = {
      catalyst: briefs.filter((b) => b.briefType === "catalyst").length * 15,
      fundamental: briefs.filter((b) => b.briefType === "fundamental").length * 20,
      flow: briefs.filter((b) => b.briefType === "flow").length * 18,
      macro: briefs.filter((b) => b.briefType === "macro").length * 10,
      technical: signals.filter((s) => s.source === "deterministic").length * 12,
      ai: signals.filter((s) => s.source === "ai").length * 15
    };

    let score = Object.values(diets).reduce((a, b) => a + b, 0);
    score = Math.min(100, score);
    if (contradictions.length > 0) score = Math.max(0, score - 20);

    const topBrief = briefs.sort((a, b) => b.impactScore - a.impactScore)[0];

    results.push({
      symbol,
      score,
      diets,
      headline: topBrief?.headline,
      briefId: topBrief?.id
    });
  }

  return results.sort((a, b) => b.score - a.score);
}
