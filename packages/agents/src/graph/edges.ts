import type { PortfolioState } from "./state.js"

/**
 * After aggregation, decide whether to proceed to risk gating
 * or skip if there is no actionable proposal.
 */
export function routeAfterAggregation(
  state: PortfolioState
): "risk_gatekeeper" | "skip" {
  if (!state.trade_proposal || state.trade_proposal.side === "FLAT") {
    return "skip"
  }
  if (state.error) return "skip"
  return "risk_gatekeeper"
}

/**
 * After risk gating, route to HITL approval, direct execution, or end.
 */
export function routeAfterRisk(
  state: PortfolioState
): "hitl_checkpoint" | "execute" | "skip" {
  const decision = state.risk_decision
  if (!decision) return "skip"

  if (!decision.approved) return "skip"

  // HITL was already flagged by the risk critic before gating
  if (state.hitl_pending) return "hitl_checkpoint"

  return "execute"
}

/**
 * After HITL checkpoint, route to execution or end.
 */
export function routeAfterHITL(
  state: PortfolioState
): "execute" | "skip" {
  // hitl_pending is cleared when approved; if still set, it was rejected/timed out
  if (state.hitl_pending) return "skip"
  if (!state.risk_decision?.approved) return "skip"
  return "execute"
}
