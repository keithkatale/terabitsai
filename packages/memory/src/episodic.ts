import type Redis from "ioredis"

export type TradeOutcomeRecord = {
  symbol: string
  side: "BUY" | "SELL" | "FLAT"
  confidence: number
  entryPrice: number
  exitPrice?: number
  outcome: "WIN" | "LOSS" | "BREAKEVEN" | "PENDING"
  pnl: number
  rationale: string
  agentVotes: Array<{ agent: string; side: string; confidence: number }>
  at: string // ISO timestamp
}

const KEY_PREFIX = "episodic"
const DEFAULT_TTL = 60 * 60 * 24 * 30 // 30 days

/**
 * Tier 1 — Episodic Memory
 * Stores trade outcomes in Redis sorted sets keyed by symbol + timestamp.
 * Agents recall recent wins/losses to adjust confidence and avoid repeated mistakes.
 */
export class EpisodicMemory {
  constructor(private readonly redis: Redis | null) {}

  async recordTrade(record: TradeOutcomeRecord): Promise<void> {
    if (!this.redis) return

    const key = `${KEY_PREFIX}:${record.symbol}`
    const score = Date.now()
    const value = JSON.stringify(record)

    // ZADD with score = timestamp for time-ordered retrieval
    await this.redis.zadd(key, score, value)
    // Keep only last 100 records per symbol
    await this.redis.zremrangebyrank(key, 0, -101)
    // Expire the key after 30 days of inactivity
    await this.redis.expire(key, DEFAULT_TTL)
  }

  async recallRecent(symbol: string, limit = 10): Promise<TradeOutcomeRecord[]> {
    if (!this.redis) return []

    try {
      const key = `${KEY_PREFIX}:${symbol}`
      const raw = await this.redis.zrevrange(key, 0, limit - 1)
      return raw.map((r) => JSON.parse(r) as TradeOutcomeRecord)
    } catch {
      return []
    }
  }

  /**
   * Returns a text summary of recent outcomes suitable for inclusion in agent prompts.
   */
  async getSummaryForPrompt(symbol: string, limit = 5): Promise<string> {
    const records = await this.recallRecent(symbol, limit)
    if (records.length === 0) return "No recent trade history for this symbol."

    const lines = records.map((r) => {
      const pnlStr = r.pnl >= 0 ? `+${r.pnl.toFixed(2)}` : r.pnl.toFixed(2)
      return `[${r.at.slice(0, 10)}] ${r.side} @ ${r.entryPrice} → ${r.outcome} (PnL: ${pnlStr}) — ${r.rationale.slice(0, 80)}`
    })

    const winRate = records.filter((r) => r.outcome === "WIN").length / records.length
    return `Recent ${symbol} trades (win rate: ${(winRate * 100).toFixed(0)}%):\n${lines.join("\n")}`
  }

  async updateOutcome(symbol: string, side: string, exitPrice: number, outcome: "WIN" | "LOSS" | "BREAKEVEN"): Promise<void> {
    if (!this.redis) return

    try {
      const key = `${KEY_PREFIX}:${symbol}`
      const pending = await this.redis.zrange(key, 0, -1)

      for (const raw of pending) {
        const record = JSON.parse(raw) as TradeOutcomeRecord
        if (record.outcome === "PENDING" && record.side === side) {
          const pnl = side === "BUY"
            ? (exitPrice - record.entryPrice) / record.entryPrice
            : (record.entryPrice - exitPrice) / record.entryPrice

          const updated: TradeOutcomeRecord = { ...record, exitPrice, outcome, pnl }
          const score = new Date(record.at).getTime()

          await this.redis.pipeline()
            .zrem(key, raw)
            .zadd(key, score, JSON.stringify(updated))
            .exec()
          break
        }
      }
    } catch (err) {
      console.error("[episodic] updateOutcome error:", err)
    }
  }
}
