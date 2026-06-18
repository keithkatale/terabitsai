import { z } from "zod"

export const DepositMethodSchema = z.enum([
  "BANK_TRANSFER",
  "CARD",
  "CRYPTO",
  "E_WALLET"
])

export type DepositMethod = z.infer<typeof DepositMethodSchema>

export const DepositStatusSchema = z.enum([
  "PENDING",
  "COMPLETED",
  "FAILED"
])

export type DepositStatus = z.infer<typeof DepositStatusSchema>

export const DepositRequestSchema = z.object({
  accountId: z.string(),
  amount: z.number().positive("Deposit amount must be greater than zero"),
  currency: z.string().default("USD"),
  method: DepositMethodSchema,
  details: z.object({
    bankName: z.string().optional(),
    cardLast4: z.string().optional(),
    cryptoWalletAddress: z.string().optional(),
    cryptoTxHash: z.string().optional(),
    eWalletEmail: z.string().optional(),
    referenceNote: z.string().optional()
  }).optional()
})

export type DepositRequest = z.infer<typeof DepositRequestSchema>

export const TimeframeSchema = z.enum([
  "1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"
])

export type Timeframe = z.infer<typeof TimeframeSchema>

export const AssetAnalysisRequestSchema = z.object({
  symbol: z.string().toUpperCase(),
  timeframe: TimeframeSchema.default("1h")
})

export type AssetAnalysisRequest = z.infer<typeof AssetAnalysisRequestSchema>

export const AgentVoteSchema = z.object({
  agent: z.string(),
  side: z.enum(["BUY", "SELL", "FLAT"]),
  confidence: z.number().min(0).max(1),
  note: z.string()
})

export type AgentVote = z.infer<typeof AgentVoteSchema>

export const TradeProposalSchema = z.object({
  symbol: z.string().toUpperCase(),
  side: z.enum(["BUY", "SELL", "FLAT"]),
  confidence: z.number().min(0).max(1),
  timeHorizon: z.enum(["scalp", "swing", "long_term"]),
  rationale: z.string(),
  agentVotes: z.array(AgentVoteSchema),
  suggestedStopPct: z.number().nonnegative(),
  suggestedSizeHint: z.number().nonnegative()
})

export type TradeProposal = z.infer<typeof TradeProposalSchema>

export const RiskDecisionSchema = z.object({
  approved: z.boolean(),
  sizedOrder: z.object({
    symbol: z.string(),
    side: z.enum(["BUY", "SELL"]),
    volume: z.number(),
    stopLoss: z.number(),
    takeProfit: z.number()
  }).optional(),
  reasons: z.array(z.string())
})

export type RiskDecision = z.infer<typeof RiskDecisionSchema>
