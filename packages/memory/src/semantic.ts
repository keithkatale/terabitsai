import type { PrismaClient } from "@prisma/client"

export type SemanticSearchResult = {
  id: string
  title: string
  body: string
  source: string
  diet: string
  symbol?: string | null
  score: number
  publishedAt?: string | null
}

/**
 * Tier 2 — Semantic Memory
 * Vector-based search over ingested IntelDocuments.
 * Uses the existing pgvector column (embedding_vec) via raw SQL when available,
 * falling back to the in-memory cosine similarity search that market-intel already provides.
 */
export class SemanticMemory {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Search for semantically similar documents using a query embedding.
   * Uses native pgvector ANN search if the embedding_vec column is populated,
   * otherwise retrieves recent docs and scores in application memory.
   */
  async search(
    queryEmbedding: number[],
    options: { limit?: number; symbol?: string; diet?: string; maxAgeDays?: number } = {}
  ): Promise<SemanticSearchResult[]> {
    const { limit = 8, symbol, diet, maxAgeDays = 7 } = options
    const since = new Date(Date.now() - maxAgeDays * 86400_000)

    try {
      // Attempt native pgvector cosine similarity search
      const vectorStr = `[${queryEmbedding.join(",")}]`
      const rows = await this.prisma.$queryRawUnsafe<Array<{
        id: string
        title: string
        body: string
        source: string
        diet: string
        symbol: string | null
        published_at: Date | null
        similarity: number
      }>>(
        `SELECT d.id, d.title, d.body, d.source, d.diet, d.symbol, d.published_at,
          1 - (e.embedding_vec <=> $1::vector) AS similarity
         FROM intel_documents d
         JOIN document_embeddings e ON e.document_id = d.id
         WHERE e.embedding_vec IS NOT NULL
           AND d.created_at > $2
           ${symbol ? "AND (d.symbol = $3 OR $3 = ANY(d.symbols))" : ""}
           ${diet ? `AND d.diet = '${diet}'` : ""}
         ORDER BY similarity DESC
         LIMIT ${limit}`,
        vectorStr,
        since,
        ...(symbol ? [symbol] : [])
      )

      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body.slice(0, 500),
        source: r.source,
        diet: r.diet,
        symbol: r.symbol,
        score: Number(r.similarity),
        publishedAt: r.published_at?.toISOString() ?? null
      }))
    } catch {
      // pgvector not available or column not populated — fall back to keyword fetch
      return this.fallbackSearch(queryEmbedding, { limit, symbol, diet, since })
    }
  }

  private async fallbackSearch(
    queryEmbedding: number[],
    opts: { limit: number; symbol?: string; diet?: string; since: Date }
  ): Promise<SemanticSearchResult[]> {
    const docs = await this.prisma.intelDocument.findMany({
      where: {
        createdAt: { gte: opts.since },
        ...(opts.symbol ? { OR: [{ symbol: opts.symbol }, { symbols: { has: opts.symbol } }] } : {}),
        ...(opts.diet ? { diet: opts.diet } : {})
      },
      include: { embedding: true },
      orderBy: { createdAt: "desc" },
      take: Math.min(opts.limit * 10, 200)
    })

    const scored = docs
      .filter((d) => d.embedding?.embedding)
      .map((d) => {
        const docEmbed = d.embedding!.embedding as number[]
        const score = cosineSimilarity(queryEmbedding, docEmbed)
        return { d, score }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, opts.limit)

    return scored.map(({ d, score }) => ({
      id: d.id,
      title: d.title,
      body: d.body.slice(0, 500),
      source: d.source,
      diet: d.diet,
      symbol: d.symbol,
      score,
      publishedAt: d.publishedAt?.toISOString() ?? null
    }))
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}
