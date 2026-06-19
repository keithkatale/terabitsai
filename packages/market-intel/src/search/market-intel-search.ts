import { prisma } from "@quant/db";
import { embedText, cosineSimilarity } from "../enrich/embedder.js";

const STOPWORDS = new Set(["the", "a", "an", "and", "or", "for", "of", "in", "on", "to", "is", "are"]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function keywordScore(query: string, docText: string): number {
  const q = new Set(tokenize(query));
  const d = tokenize(docText);
  if (q.size === 0) return 0;
  let hits = 0;
  for (const t of d) if (q.has(t)) hits++;
  return hits / q.size;
}

export type IntelSearchResult = {
  id: string;
  title: string;
  body: string;
  symbol: string | null;
  diet: string;
  source: string;
  url: string | null;
  sentiment: number | null;
  score: number;
  publishedAt: Date | null;
};

export async function searchMarketIntel(opts: {
  query: string;
  symbol?: string;
  diet?: string;
  limit?: number;
}): Promise<IntelSearchResult[]> {
  const limit = opts.limit ?? 8;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const docs = await prisma.intelDocument.findMany({
    where: {
      createdAt: { gte: since },
      ...(opts.symbol ? { OR: [{ symbol: opts.symbol }, { symbols: { has: opts.symbol } }] } : {}),
      ...(opts.diet ? { diet: opts.diet } : {})
    },
    include: { embedding: true },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  const { vector: queryVec } = await embedText(opts.query);

  const scored = docs.map((doc) => {
    const text = `${doc.title} ${doc.body}`;
    const kw = keywordScore(opts.query, text);
    let vecScore = 0;
    if (doc.embedding?.embedding && Array.isArray(doc.embedding.embedding)) {
      vecScore = cosineSimilarity(queryVec, doc.embedding.embedding as number[]);
    }
    const recency =
      doc.publishedAt ?
        Math.max(0, 1 - (Date.now() - doc.publishedAt.getTime()) / (7 * 24 * 60 * 60 * 1000))
      : 0.3;
    const score = kw * 0.4 + vecScore * 0.4 + recency * 0.2;
    return { doc, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(({ doc, score }) => ({
    id: doc.id,
    title: doc.title,
    body: doc.body.slice(0, 500),
    symbol: doc.symbol,
    diet: doc.diet,
    source: doc.source,
    url: doc.url,
    sentiment: doc.sentiment,
    score,
    publishedAt: doc.publishedAt
  }));
}

export async function getLatestCatalystBrief(symbol: string) {
  return prisma.synthesisBrief.findFirst({
    where: {
      briefType: "catalyst",
      symbols: { has: symbol },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getMacroRegime() {
  return prisma.macroRegimeSnapshot.findFirst({ orderBy: { createdAt: "desc" } });
}
