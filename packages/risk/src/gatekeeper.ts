import type {
  PortfolioState,
  RiskConfig,
  RiskDecision,
  TradeProposal
} from "@quant/contracts"

export type GatekeeperInput = {
  proposal: TradeProposal
  portfolio: PortfolioState
  config: RiskConfig
  currentPrice: number
}

function roundVolume(volume: number, increment = 0.01): number {
  return Math.floor(volume / increment) * increment
}

function computeStopPct(proposal: TradeProposal, config: RiskConfig): number {
  return Math.max(proposal.suggestedStopPct, config.minStopPct)
}

function computeStopAndTarget(
  side: "BUY" | "SELL",
  price: number,
  stopPct: number
): { stopLoss: number; takeProfit: number } {
  const riskReward = 2
  if (side === "BUY") {
    const stopLoss = price * (1 - stopPct)
    const takeProfit = price * (1 + stopPct * riskReward)
    return { stopLoss, takeProfit }
  }
  const stopLoss = price * (1 + stopPct)
  const takeProfit = price * (1 - stopPct * riskReward)
  return { stopLoss, takeProfit }
}

function totalExposureValue(portfolio: PortfolioState): number {
  return portfolio.openPositions.reduce(
    (sum, p) => sum + p.volume * p.entryPrice,
    0
  )
}

function symbolExposure(portfolio: PortfolioState, symbol: string): number {
  return portfolio.openPositions
    .filter((p) => p.symbol === symbol)
    .reduce((sum, p) => sum + p.volume * p.entryPrice, 0)
}

/**
 * Deterministic risk gatekeeper — pure functions, no LLM.
 * Consumes a TradeProposal + live portfolio state and emits APPROVE/REJECT.
 */
export function evaluateRisk(input: GatekeeperInput): RiskDecision {
  const { proposal, portfolio, config, currentPrice } = input
  const reasons: string[] = []

  if (config.killSwitchActive) {
    return { approved: false, reasons: ["Kill switch is active — all trading halted"] }
  }

  if (portfolio.dataStale) {
    return { approved: false, reasons: ["Market data is stale — trading halted"] }
  }

  if (proposal.side === "FLAT") {
    return { approved: false, reasons: ["Proposal is FLAT — no trade to execute"] }
  }

  if (proposal.confidence < 0.3) {
    reasons.push(`Confidence ${proposal.confidence.toFixed(2)} below minimum threshold 0.30`)
  }

  const dailyLossLimit = portfolio.accountBalance * config.maxDailyLossPct
  if (portfolio.dailyPnl < 0 && Math.abs(portfolio.dailyPnl) >= dailyLossLimit) {
    reasons.push(
      `Daily loss limit breached: ${Math.abs(portfolio.dailyPnl).toFixed(2)} >= ${dailyLossLimit.toFixed(2)}`
    )
  }

  if (portfolio.consecutiveLosses >= config.maxConsecutiveLosses) {
    reasons.push(
      `Circuit breaker: ${portfolio.consecutiveLosses} consecutive losses (max ${config.maxConsecutiveLosses})`
    )
  }

  if (portfolio.openPositions.length >= config.maxOpenPositions) {
    reasons.push(
      `Max open positions reached: ${portfolio.openPositions.length} >= ${config.maxOpenPositions}`
    )
  }

  const existingOnSymbol = portfolio.openPositions.filter(
    (p) => p.symbol === proposal.symbol
  )
  if (existingOnSymbol.length > 0) {
    const sameSide = existingOnSymbol.some((p) => p.side === proposal.side)
    if (sameSide) {
      reasons.push(`Already holding ${proposal.side} position on ${proposal.symbol}`)
    }
  }

  if (reasons.length > 0) {
    return { approved: false, reasons }
  }

  const stopPct = computeStopPct(proposal, config)
  const { stopLoss, takeProfit } = computeStopAndTarget(
    proposal.side,
    currentPrice,
    stopPct
  )

  const stopDistance = Math.abs(currentPrice - stopLoss)
  if (stopDistance <= 0) {
    return { approved: false, reasons: ["Invalid stop distance — cannot size position"] }
  }

  const riskBudget = portfolio.accountBalance * config.maxRiskPerTradePct
  let volume = riskBudget / stopDistance

  if (proposal.suggestedSizeHint > 0) {
    volume = Math.min(volume, proposal.suggestedSizeHint)
  }

  const positionValue = volume * currentPrice
  const maxPositionValue = portfolio.accountBalance * config.maxPositionSizePct
  if (positionValue > maxPositionValue) {
    volume = maxPositionValue / currentPrice
    reasons.push(`Position capped to ${config.maxPositionSizePct * 100}% of account`)
  }

  const currentExposure = totalExposureValue(portfolio)
  const maxExposure = portfolio.accountBalance * config.maxTotalExposurePct
  const remainingExposure = maxExposure - currentExposure
  if (remainingExposure <= 0) {
    return {
      approved: false,
      reasons: [
        `Total exposure limit reached: ${currentExposure.toFixed(2)} >= ${maxExposure.toFixed(2)}`
      ]
    }
  }

  const maxVolumeByExposure = remainingExposure / currentPrice
  if (volume * currentPrice > remainingExposure) {
    volume = maxVolumeByExposure
    reasons.push(`Volume reduced to stay within total exposure cap`)
  }

  const symbolExp = symbolExposure(portfolio, proposal.symbol)
  const maxSymbolExposure = portfolio.accountBalance * config.maxPositionSizePct
  if (symbolExp + volume * currentPrice > maxSymbolExposure) {
    const allowed = Math.max(0, maxSymbolExposure - symbolExp)
    volume = allowed / currentPrice
    reasons.push(`Volume reduced for per-symbol exposure cap on ${proposal.symbol}`)
  }

  const effectiveLeverage =
    (currentExposure + volume * currentPrice) / Math.max(portfolio.accountBalance, 1)
  if (effectiveLeverage > config.maxLeverage) {
    const maxAllowedValue = config.maxLeverage * portfolio.accountBalance - currentExposure
    if (maxAllowedValue <= 0) {
      return {
        approved: false,
        reasons: [`Leverage ceiling ${config.maxLeverage}x would be exceeded`]
      }
    }
    volume = maxAllowedValue / currentPrice
    reasons.push(`Volume reduced to respect ${config.maxLeverage}x leverage ceiling`)
  }

  volume = roundVolume(volume)
  const minVolume = 0.01
  if (volume < minVolume) {
    return {
      approved: false,
      reasons: [
        ...reasons,
        `Computed volume ${volume.toFixed(4)} below minimum tradeable size ${minVolume}`
      ]
    }
  }

  if (portfolio.availableMargin < volume * currentPrice / config.maxLeverage) {
    return {
      approved: false,
      reasons: [
        `Insufficient margin: need ~${((volume * currentPrice) / config.maxLeverage).toFixed(2)}, available ${portfolio.availableMargin.toFixed(2)}`
      ]
    }
  }

  return {
    approved: true,
    sizedOrder: {
      symbol: proposal.symbol,
      side: proposal.side,
      volume,
      stopLoss: Number(stopLoss.toFixed(6)),
      takeProfit: Number(takeProfit.toFixed(6))
    },
    reasons: reasons.length > 0 ? reasons : ["All risk checks passed"]
  }
}
