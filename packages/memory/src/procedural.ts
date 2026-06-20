import type Redis from "ioredis"

export type StrategyTemplate = {
  name: string
  version: number
  description: string
  systemPrompt: string
  entryConditions: string[]
  exitConditions: string[]
  riskParameters: {
    maxRiskPct: number
    preferredTimeHorizon: "scalp" | "swing" | "long_term"
    minConfidence: number
  }
  performanceStats?: {
    winRate: number
    avgRRR: number
    totalTrades: number
    lastUpdated: string
  }
}

const KEY_PREFIX = "procedural:strategy"

/**
 * Tier 3 — Procedural Memory
 * Stores versioned strategy templates and learned trading procedures.
 * Agents retrieve relevant strategies to guide their analysis.
 */
export class ProceduralMemory {
  constructor(private readonly redis: Redis | null) {}

  async saveStrategy(strategy: StrategyTemplate): Promise<void> {
    if (!this.redis) return

    const key = `${KEY_PREFIX}:${strategy.name}:v${strategy.version}`
    await this.redis.set(key, JSON.stringify(strategy))

    // Also update the "latest" pointer
    const latestKey = `${KEY_PREFIX}:${strategy.name}:latest`
    await this.redis.set(latestKey, JSON.stringify(strategy))
  }

  async getStrategy(name: string, version?: number): Promise<StrategyTemplate | null> {
    if (!this.redis) return null

    try {
      const key = version !== undefined
        ? `${KEY_PREFIX}:${name}:v${version}`
        : `${KEY_PREFIX}:${name}:latest`

      const raw = await this.redis.get(key)
      return raw ? (JSON.parse(raw) as StrategyTemplate) : null
    } catch {
      return null
    }
  }

  async listStrategies(): Promise<string[]> {
    if (!this.redis) return []

    try {
      const keys = await this.redis.keys(`${KEY_PREFIX}:*:latest`)
      return keys.map((k) => k.replace(`${KEY_PREFIX}:`, "").replace(":latest", ""))
    } catch {
      return []
    }
  }

  /**
   * Returns strategy guidance text for agent prompt injection.
   */
  async getGuidanceForPrompt(strategyName?: string): Promise<string> {
    if (!strategyName) return ""

    const strategy = await this.getStrategy(strategyName)
    if (!strategy) return ""

    const perfNote = strategy.performanceStats
      ? `Performance: ${(strategy.performanceStats.winRate * 100).toFixed(0)}% win rate, ${strategy.performanceStats.avgRRR.toFixed(1)}x avg R:R over ${strategy.performanceStats.totalTrades} trades.`
      : ""

    return `Strategy: ${strategy.name} v${strategy.version}
${strategy.description}
${perfNote}
Entry conditions: ${strategy.entryConditions.join("; ")}
Exit conditions: ${strategy.exitConditions.join("; ")}
Risk: max ${(strategy.riskParameters.maxRiskPct * 100).toFixed(1)}% per trade, min confidence ${strategy.riskParameters.minConfidence}`
  }
}

/**
 * Seed default strategy templates on first run.
 */
export async function seedDefaultStrategies(memory: ProceduralMemory): Promise<void> {
  const strategies: StrategyTemplate[] = [
    {
      name: "smc_swing",
      version: 1,
      description: "Smart Money Concepts swing trading — trade with institutional order flow",
      systemPrompt: "Identify institutional order blocks, fair value gaps, and market structure breaks. Only trade in the direction of BOS after a CHOCH confirmation.",
      entryConditions: [
        "Price retraces to an unmitigated bullish/bearish order block",
        "BOS confirmed on higher timeframe",
        "FVG present as confluence",
        "RSI not overbought/oversold"
      ],
      exitConditions: [
        "Price reaches opposing OB or FVG",
        "Structure break in opposite direction",
        "Daily loss limit approached"
      ],
      riskParameters: { maxRiskPct: 0.02, preferredTimeHorizon: "swing", minConfidence: 0.55 }
    },
    {
      name: "momentum_macro",
      version: 1,
      description: "Macro-driven momentum — trade with news catalysts and macro regime",
      systemPrompt: "Identify strong macro catalysts (earnings beats, economic surprises, central bank shifts). Enter on momentum with tight stops.",
      entryConditions: [
        "Clear macro catalyst identified in last 24h",
        "Price breaking above/below recent consolidation",
        "EMA20 > EMA50 for longs / EMA20 < EMA50 for shorts",
        "Macro regime supports trade direction"
      ],
      exitConditions: [
        "Catalyst fades or is priced in",
        "EMA crossover in opposite direction",
        "3 consecutive losing trades"
      ],
      riskParameters: { maxRiskPct: 0.015, preferredTimeHorizon: "swing", minConfidence: 0.6 }
    }
  ]

  for (const s of strategies) {
    await memory.saveStrategy(s)
  }
}
