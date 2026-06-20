import type { ModelRouter } from "@quant/model-router"
import { z } from "zod"
import type { PortfolioState, AgentVoteRecord } from "../state.js"

const QuantOutputSchema = z.object({
  side: z.enum(["BUY", "SELL", "FLAT"]),
  confidence: z.number().min(0).max(1),
  note: z.string(),
  entryZone: z.object({ low: z.number(), high: z.number() }).optional(),
  invalidationLevel: z.number().optional(),
  targetLevel: z.number().optional()
})

const QUANT_SYSTEM = `You are the Quantitative Specialist Agent for an autonomous quantitative wealth manager.

Your role is to evaluate:
1. Price action and structure — higher highs/lows, swing points, trend
2. Momentum indicators — RSI divergence/convergence, MACD crossovers
3. EMA alignment — trend confirmation via moving average stacks
4. Smart Money Concepts — order blocks, fair value gaps, BOS/CHOCH
5. Volume and volatility context

Provide a JSON assessment with:
- side: BUY/SELL/FLAT
- confidence: 0.0–1.0
- note: one-sentence technical summary
- entryZone: { low, high } optimal entry price range (optional)
- invalidationLevel: price that invalidates the thesis (optional)
- targetLevel: primary price target (optional)`

export async function runQuantAgent(
  router: ModelRouter,
  state: PortfolioState
): Promise<AgentVoteRecord> {
  const ctx = state.market_context
  if (!ctx) throw new Error("Quant agent: no market context")

  const recent = ctx.candles.slice(-20)
  const closes = recent.map((c) => c.c).join(", ")
  const ind = ctx.indicators

  const smcBlock = ctx.smcLevels
    ? [
        `BOS (Break of Structure): ${ctx.smcLevels.bos}`,
        `CHOCH (Change of Character): ${ctx.smcLevels.choch}`,
        `Active Bullish FVGs: ${ctx.smcLevels.fvgs.filter((f) => !f.mitigated && f.bullish).length}`,
        `Active Bearish FVGs: ${ctx.smcLevels.fvgs.filter((f) => !f.mitigated && !f.bullish).length}`,
        `Active Bullish OBs: ${ctx.smcLevels.orderBlocks.filter((o) => !o.mitigated && o.bullish).length}`,
        `Active Bearish OBs: ${ctx.smcLevels.orderBlocks.filter((o) => !o.mitigated && !o.bullish).length}`
      ].join("\n")
    : "SMC data unavailable"

  const prompt = `Technical quantitative analysis for ${ctx.symbol}:

Current price: ${ctx.currentPrice}
Recent closes (last 20): [${closes}]

Indicators:
- RSI(14): ${ind.rsi?.toFixed(2) ?? "N/A"}
- EMA20: ${ind.ema20?.toFixed(4) ?? "N/A"}
- EMA50: ${ind.ema50?.toFixed(4) ?? "N/A"}
- MACD: ${ind.macd?.toFixed(4) ?? "N/A"}

Smart Money Concepts:
${smcBlock}

Provide your quantitative/technical assessment.`

  const result = await router.structuredOutput(QuantOutputSchema, prompt, {
    tier: "fast",
    systemInstruction: QUANT_SYSTEM
  })

  const extras: string[] = []
  if (result.entryZone) extras.push(`Entry: ${result.entryZone.low}–${result.entryZone.high}`)
  if (result.invalidationLevel) extras.push(`Invalidation: ${result.invalidationLevel}`)
  if (result.targetLevel) extras.push(`Target: ${result.targetLevel}`)

  return {
    agent: "quant",
    side: result.side,
    confidence: result.confidence,
    note: extras.length ? `${result.note} | ${extras.join(" | ")}` : result.note
  }
}
