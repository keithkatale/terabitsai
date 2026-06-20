export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN"

export type SystemHealth = {
  lastQuoteAgeMs: number
  consecutiveLosses: number
  dailyDrawdownPct: number
  dataStale: boolean
  killSwitchActive?: boolean
}

export type CircuitBreakerTrip = {
  tripped: boolean
  reason: string
  state: CircuitBreakerState
  trippedAt?: string
}

// Thresholds — hardcoded, never from LLM
const THRESHOLDS = {
  maxQuoteAgeMs: 30_000,     // 30s stale data halt
  maxConsecutiveLosses: 3,   // Cool-down after 3 losses in a row
  maxDailyDrawdownPct: 0.05, // 5% daily drawdown halt
  halfOpenCooldownMs: 300_000 // 5 min before HALF_OPEN attempt
} as const

/**
 * Circuit Breaker — protects the execution layer from runaway losses
 * and data quality issues. Operates on three states:
 *  CLOSED  → normal operation
 *  OPEN    → all execution halted
 *  HALF_OPEN → one cautious test trade allowed, then auto-close or re-open
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = "CLOSED"
  private trippedAt: Date | null = null
  private lastTripReason = ""

  get currentState(): CircuitBreakerState {
    return this.state
  }

  get isOpen(): boolean {
    return this.state === "OPEN"
  }

  /**
   * Evaluate system health. Returns trip status.
   * Can transition OPEN → HALF_OPEN after cooldown.
   */
  checkHealth(health: SystemHealth): CircuitBreakerTrip {
    if (health.killSwitchActive) {
      this.trip("Kill switch activated")
      return this.tripResult()
    }

    if (health.dataStale || health.lastQuoteAgeMs > THRESHOLDS.maxQuoteAgeMs) {
      this.trip(`Data staleness: last quote ${health.lastQuoteAgeMs}ms ago (threshold: ${THRESHOLDS.maxQuoteAgeMs}ms)`)
      return this.tripResult()
    }

    if (health.consecutiveLosses >= THRESHOLDS.maxConsecutiveLosses) {
      this.trip(`Circuit breaker: ${health.consecutiveLosses} consecutive losses (threshold: ${THRESHOLDS.maxConsecutiveLosses})`)
      return this.tripResult()
    }

    if (health.dailyDrawdownPct >= THRESHOLDS.maxDailyDrawdownPct) {
      this.trip(`Daily drawdown limit breached: ${(health.dailyDrawdownPct * 100).toFixed(2)}% (threshold: ${THRESHOLDS.maxDailyDrawdownPct * 100}%)`)
      return this.tripResult()
    }

    // All checks pass — attempt to close if we were in HALF_OPEN
    if (this.state === "HALF_OPEN") {
      console.log("[circuit-breaker] All checks passed in HALF_OPEN — closing circuit")
      this.reset()
    }

    return { tripped: false, reason: "", state: this.state }
  }

  /**
   * Attempt transition from OPEN to HALF_OPEN after cooldown period.
   * Returns true if transition succeeded.
   */
  attemptHalfOpen(): boolean {
    if (this.state !== "OPEN") return false
    if (!this.trippedAt) return false

    const elapsed = Date.now() - this.trippedAt.getTime()
    if (elapsed >= THRESHOLDS.halfOpenCooldownMs) {
      console.log(`[circuit-breaker] Cooldown elapsed (${elapsed}ms) — transitioning to HALF_OPEN`)
      this.state = "HALF_OPEN"
      return true
    }

    const remaining = THRESHOLDS.halfOpenCooldownMs - elapsed
    console.log(`[circuit-breaker] Cooldown remaining: ${Math.round(remaining / 1000)}s`)
    return false
  }

  reset(): void {
    this.state = "CLOSED"
    this.trippedAt = null
    this.lastTripReason = ""
    console.log("[circuit-breaker] Circuit closed — normal operation resumed")
  }

  private trip(reason: string): void {
    if (this.state !== "OPEN") {
      console.warn(`[circuit-breaker] TRIPPED: ${reason}`)
    }
    this.state = "OPEN"
    this.trippedAt = this.trippedAt ?? new Date()
    this.lastTripReason = reason
  }

  private tripResult(): CircuitBreakerTrip {
    return {
      tripped: true,
      reason: this.lastTripReason,
      state: this.state,
      trippedAt: this.trippedAt?.toISOString()
    }
  }

  getStatus(): { state: CircuitBreakerState; reason: string; trippedAt?: string; cooldownRemainingMs?: number } {
    const base = { state: this.state, reason: this.lastTripReason }
    if (this.state === "OPEN" && this.trippedAt) {
      const elapsed = Date.now() - this.trippedAt.getTime()
      return {
        ...base,
        trippedAt: this.trippedAt.toISOString(),
        cooldownRemainingMs: Math.max(0, THRESHOLDS.halfOpenCooldownMs - elapsed)
      }
    }
    return base
  }
}

// Global singleton — shared across the engine process
export const circuitBreaker = new CircuitBreaker()
