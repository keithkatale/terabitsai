import { Annotation, messagesStateReducer } from "@langchain/langgraph"
import { BaseMessage } from "@langchain/core/messages"
import type { TradeProposal, RiskDecision, ExecutionResult } from "@quant/contracts"

export type AgentVoteRecord = {
  agent: string
  side: "BUY" | "SELL" | "FLAT"
  confidence: number
  note: string
}

export type MarketContext = {
  symbol: string
  currentPrice: number
  change24hPct: number | null
  candles: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>
  newsHeadlines: string[]
  indicators: { rsi?: number; ema20?: number; ema50?: number; macd?: number }
  macroRegime?: string
  smcLevels?: {
    fvgs: Array<{ low: number; high: number; bullish: boolean; mitigated: boolean }>
    orderBlocks: Array<{ low: number; high: number; bullish: boolean; mitigated: boolean }>
    bos: boolean
    choch: boolean
  }
}

export type HITLRequest = {
  requestId: string
  reason: string
  proposal: TradeProposal
  expiresAt: number
}

export type MemorySnapshot = {
  recentTrades: Array<{ symbol: string; side: string; outcome: string; pnl: number; at: string }>
  procedural: string
  portfolioContext: string
}

/**
 * Shared LangGraph state for the AQWM portfolio manager graph.
 * Each channel defines how values are merged across parallel nodes.
 */
export const PortfolioStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => []
  }),
  symbol: Annotation<string>({
    reducer: (_, next) => next,
    default: () => ""
  }),
  market_context: Annotation<MarketContext | null>({
    reducer: (_, next) => next,
    default: () => null
  }),
  agent_votes: Annotation<AgentVoteRecord[]>({
    reducer: (existing, next) => [...existing, ...next],
    default: () => []
  }),
  trade_proposal: Annotation<TradeProposal | null>({
    reducer: (_, next) => next,
    default: () => null
  }),
  risk_decision: Annotation<RiskDecision | null>({
    reducer: (_, next) => next,
    default: () => null
  }),
  hitl_pending: Annotation<HITLRequest | null>({
    reducer: (_, next) => next,
    default: () => null
  }),
  execution_result: Annotation<ExecutionResult | null>({
    reducer: (_, next) => next,
    default: () => null
  }),
  memory_snapshot: Annotation<MemorySnapshot | null>({
    reducer: (_, next) => next,
    default: () => null
  }),
  error: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null
  })
})

export type PortfolioState = typeof PortfolioStateAnnotation.State
