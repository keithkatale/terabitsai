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

export const OrderSideSchema = z.enum(["BUY", "SELL"])
export type OrderSide = z.infer<typeof OrderSideSchema>

export const SizedOrderSchema = z.object({
  symbol: z.string(),
  side: OrderSideSchema,
  volume: z.number().positive(),
  stopLoss: z.number().positive(),
  takeProfit: z.number().positive(),
  clientOrderId: z.string().optional()
})

export type SizedOrder = z.infer<typeof SizedOrderSchema>

export const OpenPositionSchema = z.object({
  symbol: z.string(),
  side: OrderSideSchema,
  volume: z.number().positive(),
  entryPrice: z.number().positive(),
  unrealizedPnl: z.number(),
  dealId: z.string().optional()
})

export type OpenPosition = z.infer<typeof OpenPositionSchema>

export const PortfolioStateSchema = z.object({
  accountBalance: z.number(),
  availableMargin: z.number(),
  dailyPnl: z.number(),
  openPositions: z.array(OpenPositionSchema),
  consecutiveLosses: z.number().int().nonnegative(),
  dataStale: z.boolean()
})

export type PortfolioState = z.infer<typeof PortfolioStateSchema>

export const RiskConfigSchema = z.object({
  maxRiskPerTradePct: z.number().min(0).max(1).default(0.02),
  maxDailyLossPct: z.number().min(0).max(1).default(0.03),
  maxPositionSizePct: z.number().min(0).max(1).default(0.1),
  maxTotalExposurePct: z.number().min(0).max(1).default(0.5),
  maxLeverage: z.number().positive().default(5),
  minStopPct: z.number().positive().default(0.005),
  maxOpenPositions: z.number().int().positive().default(10),
  maxConsecutiveLosses: z.number().int().positive().default(5),
  killSwitchActive: z.boolean().default(false),
  liveExecutionEnabled: z.boolean().default(false)
})

export type RiskConfig = z.infer<typeof RiskConfigSchema>

export const DEFAULT_RISK_CONFIG: RiskConfig = RiskConfigSchema.parse({})

export const AgentRunStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED"
])

export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>

export const ExecutionResultSchema = z.object({
  orderId: z.string(),
  status: z.enum(["FILLED", "REJECTED", "PENDING"]),
  filledPrice: z.number().optional(),
  dealId: z.string().optional(),
  error: z.string().optional()
})

export type ExecutionResult = z.infer<typeof ExecutionResultSchema>
