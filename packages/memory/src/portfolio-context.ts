import type Redis from "ioredis"

export type PortfolioContextRecord = {
  userId: string
  accountBalance: number
  availableMargin: number
  dailyPnl: number
  weeklyPnl: number
  openPositions: Array<{
    symbol: string
    side: "BUY" | "SELL"
    volume: number
    entryPrice: number
    unrealizedPnl: number
    dealId?: string
  }>
  consecutiveLosses: number
  totalTradestoday: number
  riskBudgetUsedPct: number
  lastUpdated: string
}

const KEY_PREFIX = "portfolio"
const DEFAULT_TTL = 86400 // 24 hours

/**
 * Tier 4 — Portfolio Context Memory
 * Real-time portfolio state injected into every agent prompt.
 * Updated on every trade and periodically reconciled with the broker.
 */
export class PortfolioContextMemory {
  constructor(private readonly redis: Redis | null) {}

  async save(context: PortfolioContextRecord): Promise<void> {
    if (!this.redis) return

    const key = `${KEY_PREFIX}:${context.userId}:context`
    await this.redis.set(key, JSON.stringify(context), "EX", DEFAULT_TTL)
  }

  async get(userId: string): Promise<PortfolioContextRecord | null> {
    if (!this.redis) return null

    try {
      const key = `${KEY_PREFIX}:${userId}:context`
      const raw = await this.redis.get(key)
      return raw ? (JSON.parse(raw) as PortfolioContextRecord) : null
    } catch {
      return null
    }
  }

  async updateAfterTrade(userId: string, update: {
    pnlDelta: number
    newPosition?: PortfolioContextRecord["openPositions"][0]
    closedPositionDealId?: string
    consecutiveLossDelta: number
  }): Promise<void> {
    if (!this.redis) return

    const existing = await this.get(userId)
    if (!existing) return

    let positions = [...existing.openPositions]

    if (update.closedPositionDealId) {
      positions = positions.filter((p) => p.dealId !== update.closedPositionDealId)
    }
    if (update.newPosition) {
      positions.push(update.newPosition)
    }

    const totalExposure = positions.reduce((sum, p) => sum + p.volume * p.entryPrice, 0)
    const riskBudgetUsedPct = existing.accountBalance > 0
      ? totalExposure / existing.accountBalance
      : 0

    const updated: PortfolioContextRecord = {
      ...existing,
      dailyPnl: existing.dailyPnl + update.pnlDelta,
      weeklyPnl: existing.weeklyPnl + update.pnlDelta,
      openPositions: positions,
      consecutiveLosses: Math.max(0, existing.consecutiveLosses + update.consecutiveLossDelta),
      totalTradestoday: existing.totalTradestoday + 1,
      riskBudgetUsedPct,
      lastUpdated: new Date().toISOString()
    }

    await this.save(updated)
  }

  /**
   * Returns portfolio context formatted for agent prompt injection.
   */
  async getSummaryForPrompt(userId: string): Promise<string> {
    const ctx = await this.get(userId)
    if (!ctx) return "Portfolio context unavailable — trading with default risk parameters."

    const exposurePct = (ctx.riskBudgetUsedPct * 100).toFixed(1)
    const dailyPnlStr = ctx.dailyPnl >= 0
      ? `+$${ctx.dailyPnl.toFixed(2)}`
      : `-$${Math.abs(ctx.dailyPnl).toFixed(2)}`

    const positionLines = ctx.openPositions.length === 0
      ? "No open positions"
      : ctx.openPositions
          .map((p) => `  ${p.symbol} ${p.side} ${p.volume} @ ${p.entryPrice} (PnL: ${p.unrealizedPnl >= 0 ? "+" : ""}${p.unrealizedPnl.toFixed(2)})`)
          .join("\n")

    return `Portfolio Context:
Balance: $${ctx.accountBalance.toFixed(2)} | Available margin: $${ctx.availableMargin.toFixed(2)}
Daily PnL: ${dailyPnlStr} | Exposure: ${exposurePct}% of account
Consecutive losses: ${ctx.consecutiveLosses} | Trades today: ${ctx.totalTradestoday}
Open positions:\n${positionLines}`
  }
}
