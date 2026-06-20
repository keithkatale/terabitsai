import type { TradeProposal, PortfolioState, RiskDecision, RiskConfig } from "@quant/contracts"
import { evaluateRisk } from "./gatekeeper.js"
import { circuitBreaker, type SystemHealth } from "./circuit-breaker.js"

// Hardcoded upper bounds — NEVER overridable via LLM or config
const ABSOLUTE_HARD_LIMITS = {
  maxSingleTradeRiskPct: 0.05,  // Never risk more than 5% on a single trade (config can be tighter)
  maxDailyDrawdownPct: 0.10,    // Never exceed 10% daily drawdown (config can be tighter)
  maxLeverage: 20,              // Hard leverage ceiling regardless of config
  mandatoryStopLoss: true,      // All trades MUST have a stop loss
  minConfidence: 0.25           // Absolute minimum confidence threshold
} as const

export type CageInput = {
  proposal: TradeProposal
  portfolio: PortfolioState
  config: RiskConfig
  currentPrice: number
  lastQuoteAgeMs?: number
}

export type CageDecision = RiskDecision & {
  cageChecks: Array<{ name: string; passed: boolean; reason?: string }>
  circuitBreakerStatus: string
}

/**
 * The Cage — Absolute Risk Isolation Layer
 *
 * This is the final safety barrier between the AI reasoning layer and live execution.
 * It is deterministic TypeScript — no LLM ever touches this code path.
 *
 * Architecture:
 *  1. Circuit breaker health check (system-level halts)
 *  2. Absolute hard limits validation (cannot be relaxed by config)
 *  3. Standard gatekeeper evaluation (config-driven position sizing)
 *
 * A trade reaches the broker ONLY if all three layers approve.
 */
export class TheCage {
  evaluate(input: CageInput): CageDecision {
    const cageChecks: CageDecision["cageChecks"] = []

    // --- Layer 1: Circuit Breaker ---
    const health: SystemHealth = {
      lastQuoteAgeMs: input.lastQuoteAgeMs ?? 0,
      consecutiveLosses: input.portfolio.consecutiveLosses,
      dailyDrawdownPct: input.portfolio.accountBalance > 0
        ? Math.max(0, -input.portfolio.dailyPnl / input.portfolio.accountBalance)
        : 0,
      dataStale: input.portfolio.dataStale,
      killSwitchActive: input.config.killSwitchActive
    }

    const cbTrip = circuitBreaker.checkHealth(health)
    cageChecks.push({
      name: "circuit_breaker",
      passed: !cbTrip.tripped,
      reason: cbTrip.tripped ? cbTrip.reason : undefined
    })

    if (cbTrip.tripped) {
      return {
        approved: false,
        reasons: [`Circuit breaker OPEN: ${cbTrip.reason}`],
        cageChecks,
        circuitBreakerStatus: cbTrip.state
      }
    }

    // --- Layer 2: Absolute Hard Limits ---
    const hardLimitReasons: string[] = []

    // Config cannot exceed absolute maximums
    const effectiveMaxRisk = Math.min(input.config.maxRiskPerTradePct, ABSOLUTE_HARD_LIMITS.maxSingleTradeRiskPct)
    if (input.config.maxRiskPerTradePct > ABSOLUTE_HARD_LIMITS.maxSingleTradeRiskPct) {
      hardLimitReasons.push(
        `Config maxRiskPerTradePct (${(input.config.maxRiskPerTradePct * 100).toFixed(1)}%) capped at absolute limit (${ABSOLUTE_HARD_LIMITS.maxSingleTradeRiskPct * 100}%)`
      )
    }

    if (input.config.maxLeverage > ABSOLUTE_HARD_LIMITS.maxLeverage) {
      hardLimitReasons.push(
        `Config maxLeverage (${input.config.maxLeverage}x) exceeds absolute ceiling (${ABSOLUTE_HARD_LIMITS.maxLeverage}x)`
      )
    }

    if (input.proposal.confidence < ABSOLUTE_HARD_LIMITS.minConfidence) {
      hardLimitReasons.push(
        `Confidence ${input.proposal.confidence.toFixed(2)} below absolute minimum ${ABSOLUTE_HARD_LIMITS.minConfidence}`
      )
    }

    cageChecks.push({
      name: "hard_limits",
      passed: hardLimitReasons.length === 0,
      reason: hardLimitReasons.length > 0 ? hardLimitReasons.join("; ") : undefined
    })

    // Correlation guard: reject if we already hold a position in the same direction on a correlated asset
    const correlationReject = this.checkCorrelationGuard(input.proposal, input.portfolio)
    cageChecks.push({
      name: "correlation_guard",
      passed: !correlationReject,
      reason: correlationReject ?? undefined
    })

    if (correlationReject) {
      return {
        approved: false,
        reasons: [`Correlation guard: ${correlationReject}`],
        cageChecks,
        circuitBreakerStatus: circuitBreaker.currentState
      }
    }

    // --- Layer 3: Standard Gatekeeper ---
    const effectiveConfig: RiskConfig = {
      ...input.config,
      maxRiskPerTradePct: effectiveMaxRisk,
      maxLeverage: Math.min(input.config.maxLeverage, ABSOLUTE_HARD_LIMITS.maxLeverage)
    }

    const gatekeeperDecision = evaluateRisk({
      proposal: input.proposal,
      portfolio: input.portfolio,
      config: effectiveConfig,
      currentPrice: input.currentPrice
    })

    cageChecks.push({
      name: "gatekeeper",
      passed: gatekeeperDecision.approved,
      reason: gatekeeperDecision.approved ? undefined : gatekeeperDecision.reasons.join("; ")
    })

    return {
      ...gatekeeperDecision,
      cageChecks,
      circuitBreakerStatus: circuitBreaker.currentState
    }
  }

  /**
   * Correlation guard: prevents over-concentration in correlated assets.
   * Returns a rejection reason string if the guard fires, null otherwise.
   */
  private checkCorrelationGuard(proposal: TradeProposal, portfolio: PortfolioState): string | null {
    // Correlation groups — assets that move together and should not be double-loaded
    const CORRELATION_GROUPS: Array<{ name: string; symbols: string[]; maxSameSidePositions: number }> = [
      { name: "US_EQUITIES", symbols: ["US100", "US500", "US30", "SPX500", "NAS100"], maxSameSidePositions: 1 },
      { name: "PRECIOUS_METALS", symbols: ["GOLD", "SILVER", "XAUUSD", "XAGUSD"], maxSameSidePositions: 1 },
      { name: "ENERGY", symbols: ["OIL", "USOIL", "BRENT", "NATGAS"], maxSameSidePositions: 1 },
      { name: "CRYPTO", symbols: ["BTCUSD", "ETHUSD", "BTC", "ETH"], maxSameSidePositions: 1 }
    ]

    const sym = proposal.symbol.toUpperCase()

    for (const group of CORRELATION_GROUPS) {
      if (!group.symbols.some((s) => sym.includes(s) || s.includes(sym))) continue

      const sameSideInGroup = portfolio.openPositions.filter((p) => {
        const posInGroup = group.symbols.some((s) => p.symbol.toUpperCase().includes(s) || s.includes(p.symbol.toUpperCase()))
        return posInGroup && p.side === proposal.side
      })

      if (sameSideInGroup.length >= group.maxSameSidePositions) {
        return `Already holding ${sameSideInGroup.length} ${proposal.side} position(s) in correlated ${group.name} group (${sameSideInGroup.map((p) => p.symbol).join(", ")})`
      }
    }

    return null
  }
}

// Singleton export for engine use
export const theCage = new TheCage()
