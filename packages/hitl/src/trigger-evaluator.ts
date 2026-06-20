import type { TradeProposal, PortfolioState } from "@quant/contracts"
import { HITL_TRIGGERS } from "./types.js"

export type HITLTriggerResult = {
  required: boolean
  reasons: string[]
}

/**
 * Evaluates whether a trade proposal requires human approval before execution.
 * Called after risk gating passes — this is the final human override checkpoint.
 */
export function evaluateHITLTriggers(
  proposal: TradeProposal,
  portfolio: PortfolioState,
  sizedVolume: number,
  currentPrice: number
): HITLTriggerResult {
  const reasons: string[] = []

  // Check position size relative to account
  const positionValue = sizedVolume * currentPrice
  const sizePct = portfolio.accountBalance > 0 ? positionValue / portfolio.accountBalance : 0
  if (HITL_TRIGGERS.largePosition(sizePct)) {
    reasons.push(`Large position: ${(sizePct * 100).toFixed(1)}% of account value`)
  }

  // Check risk per trade
  const riskPct = proposal.suggestedStopPct * sizePct
  if (HITL_TRIGGERS.highRisk(riskPct)) {
    reasons.push(`High risk per trade: ${(riskPct * 100).toFixed(2)}% of account`)
  }

  // Check for conflicting agent signals
  if (HITL_TRIGGERS.conflictingSignals(proposal.agentVotes)) {
    const sides = proposal.agentVotes.map((v) => `${v.agent}: ${v.side} (${v.confidence.toFixed(2)})`)
    reasons.push(`Conflicting agent signals: ${sides.join(", ")}`)
  }

  // Check consensus quality
  if (proposal.agentVotes.length > 0 && HITL_TRIGGERS.lowConsensus(proposal.agentVotes, proposal.side)) {
    const agreeing = proposal.agentVotes.filter((v) => v.side === proposal.side).length
    reasons.push(`Low agent consensus: only ${agreeing}/${proposal.agentVotes.length} agents agree`)
  }

  // Check volatile asset class
  if (HITL_TRIGGERS.volatileSymbol(proposal.symbol)) {
    reasons.push(`High-volatility asset class: ${proposal.symbol}`)
  }

  return { required: reasons.length > 0, reasons }
}
