import type { ModelRouter } from "@quant/model-router"
import { z } from "zod"
import type { PortfolioState, AgentVoteRecord } from "../state.js"

const RiskCriticOutputSchema = z.object({
  side: z.enum(["BUY", "SELL", "FLAT"]),
  confidence: z.number().min(0).max(1),
  note: z.string(),
  contradictions: z.array(z.string()).default([]),
  maxRecommendedRiskPct: z.number().min(0).max(0.05).default(0.02),
  requiresHITL: z.boolean().default(false),
  hitlReason: z.string().optional()
})

const RISK_CRITIC_SYSTEM = `You are the Risk Critic Agent for an autonomous quantitative wealth manager.

Your role is to independently evaluate risk and act as a devil's advocate:
1. Challenge the consensus — look for reasons the trade could fail
2. Identify contradictions between news, technicals, and macro
3. Assess timing risk — is now the right time, or should we wait?
4. Evaluate position sizing risk relative to current portfolio exposure
5. Flag trades that require human approval

You vote FLAT if risks outweigh potential. You never chase momentum.

Provide a JSON assessment with:
- side: BUY/SELL/FLAT (your independent risk-adjusted view)
- confidence: 0.0–1.0
- note: one-sentence risk summary
- contradictions: up to 3 conflicting signals you identified
- maxRecommendedRiskPct: max % of account to risk (0.005–0.02)
- requiresHITL: true if this trade needs human approval before execution
- hitlReason: explanation if requiresHITL is true`

export async function runRiskCriticAgent(
  router: ModelRouter,
  state: PortfolioState
): Promise<AgentVoteRecord & { requiresHITL: boolean; hitlReason?: string; maxRecommendedRiskPct: number }> {
  const ctx = state.market_context
  if (!ctx) throw new Error("Risk critic agent: no market context")

  const voteSummary = state.agent_votes.length
    ? state.agent_votes.map((v) => `- ${v.agent}: ${v.side} (${v.confidence.toFixed(2)}) — ${v.note}`).join("\n")
    : "No prior votes available"

  const prompt = `Risk critique for proposed trade on ${ctx.symbol}:

Current price: ${ctx.currentPrice}
24h change: ${ctx.change24hPct ?? "unknown"}%
Macro regime: ${ctx.macroRegime ?? "unknown"}

Other agent votes so far:
${voteSummary}

SMC structure: ${ctx.smcLevels ? `BOS=${ctx.smcLevels.bos}, CHOCH=${ctx.smcLevels.choch}` : "unavailable"}
RSI: ${ctx.indicators.rsi?.toFixed(2) ?? "N/A"}

Critically evaluate the risk of taking this trade now. Be conservative. Vote FLAT if genuinely unsure.`

  const result = await router.structuredOutput(RiskCriticOutputSchema, prompt, {
    tier: "frontier",
    systemInstruction: RISK_CRITIC_SYSTEM
  })

  const contradictionNote = result.contradictions.length
    ? ` | Contradictions: ${result.contradictions.join("; ")}`
    : ""

  return {
    agent: "risk_critic",
    side: result.side,
    confidence: result.confidence,
    note: `${result.note}${contradictionNote}`,
    requiresHITL: result.requiresHITL,
    hitlReason: result.hitlReason,
    maxRecommendedRiskPct: result.maxRecommendedRiskPct
  }
}
