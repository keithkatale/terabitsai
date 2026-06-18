import { z } from "zod"
import { AgentVoteSchema } from "@quant/contracts"
import type { ModelRouter } from "@quant/model-router"

const AgentOutputSchema = z.object({
  side: z.enum(["BUY", "SELL", "FLAT"]),
  confidence: z.number().min(0).max(1),
  note: z.string()
})

export type AgentContext = {
  symbol: string
  currentPrice: number
  change24hPct: number | null
  candles: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>
  newsHeadlines?: string[]
  sentiment?: { longPct: number; shortPct: number }
}

const MACRO_SYSTEM = `You are a macro/fundamental trading analyst. Evaluate news sentiment, economic context, and market health. Output strict JSON with side (BUY/SELL/FLAT), confidence (0-1), and a brief note.`

const TECHNICAL_SYSTEM = `You are a technical analyst. Evaluate price action, momentum, and indicator signals from the provided OHLCV data. Output strict JSON with side (BUY/SELL/FLAT), confidence (0-1), and a brief note.`

export async function runMacroAgent(
  router: ModelRouter,
  ctx: AgentContext
): Promise<z.infer<typeof AgentOutputSchema>> {
  const newsBlock =
    ctx.newsHeadlines?.length ?
      `Recent headlines:\n${ctx.newsHeadlines.map((h) => `- ${h}`).join("\n")}`
    : "No recent news available."

  const prompt = `Symbol: ${ctx.symbol}
Current price: ${ctx.currentPrice}
24h change: ${ctx.change24hPct ?? "unknown"}%
${newsBlock}
${ctx.sentiment ? `Client sentiment: ${ctx.sentiment.longPct}% long / ${ctx.sentiment.shortPct}% short` : ""}

Provide your macro/fundamental assessment.`

  return router.structuredOutput(AgentOutputSchema, prompt, {
    tier: "frontier",
    systemInstruction: MACRO_SYSTEM
  })
}

export async function runTechnicalAgent(
  router: ModelRouter,
  ctx: AgentContext,
  indicators: { rsi?: number; ema20?: number; ema50?: number }
): Promise<z.infer<typeof AgentOutputSchema>> {
  const recent = ctx.candles.slice(-20)
  const closes = recent.map((c) => c.c).join(", ")

  const prompt = `Symbol: ${ctx.symbol}
Current price: ${ctx.currentPrice}
Recent closes (last 20): [${closes}]
RSI(14): ${indicators.rsi?.toFixed(2) ?? "N/A"}
EMA20: ${indicators.ema20?.toFixed(2) ?? "N/A"}
EMA50: ${indicators.ema50?.toFixed(2) ?? "N/A"}

Provide your technical assessment.`

  return router.structuredOutput(AgentOutputSchema, prompt, {
    tier: "fast",
    systemInstruction: TECHNICAL_SYSTEM
  })
}

export function computeSimpleIndicators(
  candles: AgentContext["candles"]
): { rsi?: number; ema20?: number; ema50?: number } {
  const closes = candles.map((c) => c.c)
  if (closes.length < 15) return {}

  const ema = (period: number): number => {
    const k = 2 / (period + 1)
    let val = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
    for (let i = period; i < closes.length; i++) {
      val = closes[i] * k + val * (1 - k)
    }
    return val
  }

  const gains: number[] = []
  const losses: number[] = []
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    gains.push(diff > 0 ? diff : 0)
    losses.push(diff < 0 ? -diff : 0)
  }
  const avgGain = gains.slice(-14).reduce((a, b) => a + b, 0) / 14
  const avgLoss = losses.slice(-14).reduce((a, b) => a + b, 0) / 14
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
  const rsi = 100 - 100 / (1 + rs)

  return { rsi, ema20: ema(20), ema50: ema(50) }
}

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

export async function runAggregator(
  router: ModelRouter,
  symbol: string,
  votes: Array<{ agent: string; side: string; confidence: number; note: string }>
): Promise<z.infer<typeof AggregatorOutputSchema>> {
  const prompt = `Merge these agent votes into a single TradeProposal for ${symbol}:

${votes.map((v) => `- ${v.agent}: ${v.side} (confidence ${v.confidence}) — ${v.note}`).join("\n")}

Rules:
- If agents disagree, lean FLAT unless confidence gap > 0.2
- suggestedStopPct: 0.005-0.03 based on volatility consensus
- suggestedSizeHint: conservative (0.1-2.0 units)
- timeHorizon: swing unless scalping signals dominate`

  return router.structuredOutput(AggregatorOutputSchema, prompt, {
    tier: "frontier",
    systemInstruction:
      "You are the trade proposal aggregator. Merge agent votes into one coherent TradeProposal JSON."
  })
}
