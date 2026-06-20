import { z } from "zod"

export const HITLDecisionSchema = z.enum(["APPROVED", "REJECTED", "TIMEOUT"])
export type HITLDecision = z.infer<typeof HITLDecisionSchema>

export const HITLRequestSchema = z.object({
  requestId: z.string().uuid(),
  threadId: z.string(),
  symbol: z.string(),
  side: z.enum(["BUY", "SELL"]),
  confidence: z.number(),
  rationale: z.string(),
  agentVotes: z.array(z.object({
    agent: z.string(),
    side: z.string(),
    confidence: z.number(),
    note: z.string()
  })),
  riskSummary: z.string(),
  triggerReasons: z.array(z.string()),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime()
})
export type HITLRequest = z.infer<typeof HITLRequestSchema>

export const HITLResponseSchema = z.object({
  requestId: z.string(),
  decision: HITLDecisionSchema,
  reviewerNote: z.string().optional(),
  decidedAt: z.string().datetime()
})
export type HITLResponse = z.infer<typeof HITLResponseSchema>

export const HITL_TRIGGERS = {
  largePosition: (sizePct: number) => sizePct > 0.08,             // >8% of account in one trade
  highRisk: (riskPct: number) => riskPct > 0.015,                 // >1.5% risk per trade
  conflictingSignals: (votes: Array<{ side: string; confidence: number }>) => {
    const sides = new Set(votes.map((v) => v.side).filter((s) => s !== "FLAT"))
    return sides.size > 1 && votes.some((v) => v.confidence > 0.65)
  },
  lowConsensus: (votes: Array<{ side: string; confidence: number }>, proposedSide: string) => {
    const agreeing = votes.filter((v) => v.side === proposedSide).length
    return agreeing < Math.ceil(votes.length / 2)
  },
  volatileSymbol: (symbol: string) => {
    const volatile = ["BTCUSD", "ETHUSD", "BTC", "ETH"]
    return volatile.some((s) => symbol.toUpperCase().includes(s))
  }
} as const
