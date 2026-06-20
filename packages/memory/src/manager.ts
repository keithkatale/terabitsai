import { getRedisClient } from "./redis-client.js"
import { EpisodicMemory } from "./episodic.js"
import { SemanticMemory } from "./semantic.js"
import { ProceduralMemory, seedDefaultStrategies } from "./procedural.js"
import { PortfolioContextMemory } from "./portfolio-context.js"
import { InContextWindow } from "./in-context.js"
import { prisma } from "@quant/db"

export type MemoryRecallContext = {
  symbol: string
  userId?: string
  strategyName?: string
  queryEmbedding?: number[]
  timeHorizon?: "scalp" | "swing" | "long_term"
  topK?: number
}

export type FullMemorySnapshot = {
  inContextSummary: string
  episodicSummary: string
  semanticResults: Array<{ title: string; body: string; source: string; score: number }>
  proceduralGuidance: string
  portfolioContext: string
}

/**
 * Financial Memory Manager
 * Provides a unified interface to all 5 memory tiers for agent prompt enrichment.
 * All tiers degrade gracefully if their backing store is unavailable.
 */
export class FinancialMemoryManager {
  readonly episodic: EpisodicMemory
  readonly semantic: SemanticMemory
  readonly procedural: ProceduralMemory
  readonly portfolioContext: PortfolioContextMemory
  readonly inContext: InContextWindow

  private static _instance: FinancialMemoryManager | null = null

  constructor() {
    const redis = getRedisClient()
    this.episodic = new EpisodicMemory(redis)
    this.semantic = new SemanticMemory(prisma)
    this.procedural = new ProceduralMemory(redis)
    this.portfolioContext = new PortfolioContextMemory(redis)
    this.inContext = new InContextWindow()
  }

  static getInstance(): FinancialMemoryManager {
    if (!FinancialMemoryManager._instance) {
      FinancialMemoryManager._instance = new FinancialMemoryManager()
    }
    return FinancialMemoryManager._instance
  }

  /**
   * Recall memory across all relevant tiers for a given analysis context.
   * Returns a snapshot suitable for injecting into agent prompts.
   */
  async recall(ctx: MemoryRecallContext): Promise<FullMemorySnapshot> {
    const [episodicSummary, proceduralGuidance, portfolioContext] = await Promise.all([
      this.episodic.getSummaryForPrompt(ctx.symbol, 5),
      this.procedural.getGuidanceForPrompt(ctx.strategyName),
      ctx.userId ? this.portfolioContext.getSummaryForPrompt(ctx.userId) : Promise.resolve("")
    ])

    let semanticResults: FullMemorySnapshot["semanticResults"] = []
    if (ctx.queryEmbedding && ctx.queryEmbedding.length > 0) {
      try {
        const results = await this.semantic.search(ctx.queryEmbedding, {
          symbol: ctx.symbol,
          limit: ctx.topK ?? 5
        })
        semanticResults = results.map((r) => ({
          title: r.title,
          body: r.body,
          source: r.source,
          score: r.score
        }))
      } catch {
        // Semantic search failure is non-fatal
      }
    }

    const inContextSummary = this.inContext.toPromptString()

    return { inContextSummary, episodicSummary, semanticResults, proceduralGuidance, portfolioContext }
  }

  /**
   * Build a compact prompt-injection string from all memory tiers.
   */
  async buildMemoryBlock(ctx: MemoryRecallContext): Promise<string> {
    const snapshot = await this.recall(ctx)
    const sections: string[] = []

    if (snapshot.portfolioContext) sections.push(snapshot.portfolioContext)
    if (snapshot.episodicSummary && !snapshot.episodicSummary.startsWith("No recent")) {
      sections.push(`Trade History:\n${snapshot.episodicSummary}`)
    }
    if (snapshot.proceduralGuidance) sections.push(`Strategy Context:\n${snapshot.proceduralGuidance}`)
    if (snapshot.semanticResults.length > 0) {
      const intel = snapshot.semanticResults
        .slice(0, 3)
        .map((r) => `[${r.source}] ${r.title}: ${r.body.slice(0, 200)}`)
        .join("\n")
      sections.push(`Relevant Intelligence:\n${intel}`)
    }
    if (snapshot.inContextSummary) sections.push(`Recent Context:\n${snapshot.inContextSummary}`)

    return sections.join("\n\n---\n\n")
  }

  async initialize(): Promise<void> {
    await seedDefaultStrategies(this.procedural)
  }
}

// Singleton export for engine/agent use
export const memory = FinancialMemoryManager.getInstance()
