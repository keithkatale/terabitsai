import type { TradeProposal } from "@quant/contracts"
import { ModelRouter } from "@quant/model-router"
import {
  computeSimpleIndicators,
  runAggregator,
  runMacroAgent,
  runTechnicalAgent,
  type AgentContext
} from "./agents.js"

export type OrchestratorInput = {
  symbol: string
  currentPrice: number
  change24hPct: number | null
  candles: AgentContext["candles"]
  newsHeadlines?: string[]
}

export type OrchestratorResult = {
  proposal: TradeProposal
  agentOutputs: {
    macro: { side: string; confidence: number; note: string }
    technical: { side: string; confidence: number; note: string }
  }
}

/**
 * Deterministic orchestrator — sequences agents, no LLM.
 */
export async function runOrchestrator(
  input: OrchestratorInput,
  router?: ModelRouter
): Promise<OrchestratorResult> {
  const modelRouter = router ?? new ModelRouter()

  const ctx: AgentContext = {
    symbol: input.symbol,
    currentPrice: input.currentPrice,
    change24hPct: input.change24hPct,
    candles: input.candles,
    newsHeadlines: input.newsHeadlines
  }

  const indicators = computeSimpleIndicators(input.candles)

  const [macro, technical] = await Promise.all([
    runMacroAgent(modelRouter, ctx),
    runTechnicalAgent(modelRouter, ctx, indicators)
  ])

  const votes = [
    { agent: "macro", ...macro },
    { agent: "technical", ...technical }
  ]

  const proposal = await runAggregator(modelRouter, input.symbol, votes)

  return {
    proposal,
    agentOutputs: { macro, technical }
  }
}

export {
  runMacroAgent,
  runTechnicalAgent,
  runAggregator,
  computeSimpleIndicators,
  type AgentContext
} from "./agents.js"
