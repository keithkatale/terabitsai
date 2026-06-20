import { ModelRouter } from "@quant/model-router"
import { AgentVoteSchema, type TradeProposal } from "@quant/contracts"
import { z } from "zod"
import type { PortfolioState, MarketContext } from "./state.js"
import { runIntelligenceAgent } from "./specialist-workers/intelligence-agent.js"
import { runQuantAgent } from "./specialist-workers/quant-agent.js"
import { runRiskCriticAgent } from "./specialist-workers/risk-critic-agent.js"
import { computeSimpleIndicators } from "../agents.js"

const router = new ModelRouter()

const AggregatorOutputSchema = z.object({
  symbol: z.string(),
  side: z.enum(["BUY", "SELL", "FLAT"]),
  confidence: z.number().min(0).max(1),
  timeHorizon: z.enum(["scalp", "swing", "long_term"]),
  rationale: z.string(),
  agentVotes: z.array(AgentVoteSchema),
  suggestedStopPct: z.number().nonnegative(),
  suggestedSizeHint: z.number().nonnegative()
})

/**
 * Enriches market context with computed indicators and SMC levels.
 * Consumes raw candle data already in state to produce a fully-enriched context.
 */
export async function gatherContextNode(state: PortfolioState): Promise<Partial<PortfolioState>> {
  const ctx = state.market_context
  if (!ctx) return { error: "gatherContextNode: market_context not set before graph entry" }

  const indicators = computeSimpleIndicators(ctx.candles)

  let smcLevels: MarketContext["smcLevels"] | undefined
  try {
    const { detectSMC } = await import("@quant/indicators")
    const smcCandles = ctx.candles.map((c) => ({
      time: c.t,
      open: c.o,
      high: c.h,
      low: c.l,
      close: c.c,
      volume: c.v
    }))
    const smc = detectSMC(smcCandles)
    smcLevels = {
      fvgs: smc.fvgs.map((f) => ({ low: f.bottom, high: f.top, bullish: f.type === "BULLISH", mitigated: f.mitigated })),
      orderBlocks: smc.orderBlocks.map((o) => ({ low: o.low, high: o.high, bullish: o.type === "BULLISH", mitigated: o.mitigated })),
      bos: smc.bos,
      choch: smc.choch
    }
  } catch {
    // SMC computation is optional — continue without it
  }

  return {
    market_context: {
      ...ctx,
      indicators,
      smcLevels
    }
  }
}

/**
 * Intelligence specialist: news, macro, catalysts.
 */
export async function intelligenceAgentNode(state: PortfolioState): Promise<Partial<PortfolioState>> {
  try {
    const vote = await runIntelligenceAgent(router, state)
    return { agent_votes: [vote] }
  } catch (err) {
    console.error("[intelligence-agent] Error:", err)
    return { agent_votes: [{ agent: "intelligence", side: "FLAT", confidence: 0, note: `Error: ${String(err)}` }] }
  }
}

/**
 * Quant specialist: technical analysis, indicators, SMC.
 */
export async function quantAgentNode(state: PortfolioState): Promise<Partial<PortfolioState>> {
  try {
    const vote = await runQuantAgent(router, state)
    return { agent_votes: [vote] }
  } catch (err) {
    console.error("[quant-agent] Error:", err)
    return { agent_votes: [{ agent: "quant", side: "FLAT", confidence: 0, note: `Error: ${String(err)}` }] }
  }
}

/**
 * Risk critic: challenges the consensus, flags HITL requirements.
 */
export async function riskCriticNode(state: PortfolioState): Promise<Partial<PortfolioState>> {
  try {
    const result = await runRiskCriticAgent(router, state)
    const vote = { agent: result.agent, side: result.side, confidence: result.confidence, note: result.note }

    if (result.requiresHITL) {
      return {
        agent_votes: [vote],
        hitl_pending: {
          requestId: crypto.randomUUID(),
          reason: result.hitlReason ?? "Risk critic flagged this trade for human review",
          proposal: state.trade_proposal!,
          expiresAt: Date.now() + 3_600_000
        }
      }
    }

    return { agent_votes: [vote] }
  } catch (err) {
    console.error("[risk-critic] Error:", err)
    return { agent_votes: [{ agent: "risk_critic", side: "FLAT", confidence: 0, note: `Error: ${String(err)}` }] }
  }
}

/**
 * Portfolio Manager aggregator: merges all specialist votes into a single TradeProposal.
 */
export async function aggregateProposalsNode(state: PortfolioState): Promise<Partial<PortfolioState>> {
  const ctx = state.market_context
  if (!ctx) return { error: "aggregateProposalsNode: no market context" }

  const votes = state.agent_votes
  if (votes.length === 0) return { trade_proposal: null }

  const prompt = `You are the Portfolio Manager. Merge these specialist agent votes into one TradeProposal for ${ctx.symbol}:

${votes.map((v) => `- ${v.agent}: ${v.side} (confidence ${v.confidence.toFixed(2)}) — ${v.note}`).join("\n")}

Aggregation rules:
- Require at least 2/3 agents to agree on direction; otherwise return FLAT
- Weight risk_critic votes 1.5× — the risk critic is a deliberate conservative voice
- If risk_critic voted FLAT with confidence > 0.6, return FLAT regardless
- suggestedStopPct: 0.005–0.03 based on volatility consensus
- suggestedSizeHint: conservative 0.1–2.0 units
- timeHorizon: swing unless clear scalp signals from quant agent`

  try {
    const proposal = await router.structuredOutput(AggregatorOutputSchema, prompt, {
      tier: "frontier",
      systemInstruction: "You are the Portfolio Manager. Aggregate specialist votes into a single coherent TradeProposal JSON."
    }) as TradeProposal

    return { trade_proposal: proposal }
  } catch (err) {
    console.error("[aggregate-proposals] Error:", err)
    return { error: `Aggregation failed: ${String(err)}` }
  }
}
