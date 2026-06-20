import type { ModelRouter } from "@quant/model-router"
import { z } from "zod"
import type { PortfolioState, AgentVoteRecord } from "../state.js"

const IntelligenceOutputSchema = z.object({
  side: z.enum(["BUY", "SELL", "FLAT"]),
  confidence: z.number().min(0).max(1),
  note: z.string(),
  keyDrivers: z.array(z.string()).default([]),
  riskFactors: z.array(z.string()).default([])
})

const INTELLIGENCE_SYSTEM = `You are the Intelligence Specialist Agent for an autonomous quantitative wealth manager.

Your role is to evaluate:
1. News sentiment and momentum — breaking catalysts, institutional flow narratives
2. Macro regime context — risk-on/off, rates, volatility environment
3. Market structure narrative — is smart money accumulating or distributing?
4. Contradiction signals — when news and price action diverge

Provide a JSON assessment with:
- side: BUY/SELL/FLAT
- confidence: 0.0–1.0 (only go above 0.7 when evidence is strong and converging)
- note: one-sentence summary of your conviction
- keyDrivers: up to 3 bullish/bearish catalysts driving your view
- riskFactors: up to 3 risks that could invalidate your thesis`

export async function runIntelligenceAgent(
  router: ModelRouter,
  state: PortfolioState
): Promise<AgentVoteRecord> {
  const ctx = state.market_context
  if (!ctx) throw new Error("Intelligence agent: no market context")

  const newsBlock = ctx.newsHeadlines.length
    ? ctx.newsHeadlines.map((h) => `- ${h}`).join("\n")
    : "No recent news available."

  const macroBlock = ctx.macroRegime
    ? `Macro regime: ${ctx.macroRegime}`
    : "Macro regime: unknown"

  const smcBlock = ctx.smcLevels
    ? `SMC Structure: BOS=${ctx.smcLevels.bos}, CHOCH=${ctx.smcLevels.choch}, Active FVGs=${ctx.smcLevels.fvgs.filter((f) => !f.mitigated).length}, Active OBs=${ctx.smcLevels.orderBlocks.filter((o) => !o.mitigated).length}`
    : ""

  const prompt = `Assess market intelligence for ${ctx.symbol}:

Current price: ${ctx.currentPrice}
24h change: ${ctx.change24hPct ?? "unknown"}%
${macroBlock}
${smcBlock}

Recent news/catalysts:
${newsBlock}

Provide your intelligence-driven assessment.`

  const result = await router.structuredOutput(IntelligenceOutputSchema, prompt, {
    tier: "frontier",
    systemInstruction: INTELLIGENCE_SYSTEM
  })

  return {
    agent: "intelligence",
    side: result.side,
    confidence: result.confidence,
    note: `${result.note} | Drivers: ${result.keyDrivers.join("; ")} | Risks: ${result.riskFactors.join("; ")}`
  }
}
