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

// ── Market intelligence contracts ───────────────────────────────────────────

export const IntelScanTypeSchema = z.enum(["hot", "full", "sector"])
export type IntelScanType = z.infer<typeof IntelScanTypeSchema>

export const IntelScanStatusSchema = z.enum(["RUNNING", "COMPLETED", "FAILED"])
export type IntelScanStatus = z.infer<typeof IntelScanStatusSchema>

export const SignalActionSchema = z.enum(["BUY", "SELL", "WATCH"])
export type SignalAction = z.infer<typeof SignalActionSchema>

export const SignalSourceSchema = z.enum(["deterministic", "ai", "news"])
export type SignalSource = z.infer<typeof SignalSourceSchema>

export const IntelScanRunSchema = z.object({
  id: z.string(),
  scanType: IntelScanTypeSchema,
  status: IntelScanStatusSchema,
  symbolsScanned: z.number().int().nonnegative(),
  signalsCreated: z.number().int().nonnegative(),
  error: z.string().nullable().optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable().optional()
})

export type IntelScanRun = z.infer<typeof IntelScanRunSchema>

export const MarketSignalSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  strategy: z.string(),
  action: SignalActionSchema,
  timeframe: z.string(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  source: SignalSourceSchema,
  payload: z.record(z.unknown()).nullable().optional(),
  sector: z.string().nullable().optional(),
  assetClass: z.string().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  scanRunId: z.string().nullable().optional(),
  createdAt: z.string().datetime()
})

export type MarketSignal = z.infer<typeof MarketSignalSchema>

export const MarketNewsItemSchema = z.object({
  id: z.string(),
  symbol: z.string().nullable().optional(),
  headline: z.string(),
  summary: z.string(),
  sentiment: z.enum(["bullish", "bearish", "neutral"]),
  source: z.string(),
  url: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  scanRunId: z.string().nullable().optional(),
  createdAt: z.string().datetime()
})

export type MarketNewsItem = z.infer<typeof MarketNewsItemSchema>

export const InvestOpportunitySchema = z.object({
  id: z.string(),
  title: z.string(),
  thesis: z.string(),
  symbols: z.array(z.string()),
  horizon: z.enum(["intraday", "swing", "position"]),
  conviction: z.number().int().min(1).max(5),
  style: z.enum(["growth", "value", "income", "thematic"]),
  sector: z.string().nullable().optional(),
  payload: z.record(z.unknown()).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  scanRunId: z.string().nullable().optional(),
  createdAt: z.string().datetime()
})

export type InvestOpportunity = z.infer<typeof InvestOpportunitySchema>

export const MarketPulseThemeSchema = z.object({
  label: z.string(),
  value: z.string()
})

export const MarketPulseSnapshotSchema = z.object({
  id: z.string(),
  themes: z.array(MarketPulseThemeSchema),
  scanRunId: z.string().nullable().optional(),
  createdAt: z.string().datetime()
})

export type MarketPulseSnapshot = z.infer<typeof MarketPulseSnapshotSchema>

export const IntelFeedItemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("signal"), item: MarketSignalSchema, at: z.string().datetime() }),
  z.object({ kind: z.literal("news"), item: MarketNewsItemSchema, at: z.string().datetime() }),
  z.object({ kind: z.literal("opportunity"), item: InvestOpportunitySchema, at: z.string().datetime() })
])

export type IntelFeedItem = z.infer<typeof IntelFeedItemSchema>

export const IntelFeedResponseSchema = z.object({
  success: z.boolean(),
  items: z.array(IntelFeedItemSchema),
  nextCursor: z.string().nullable().optional()
})

export type IntelFeedResponse = z.infer<typeof IntelFeedResponseSchema>

// ── Market synthesis platform contracts ─────────────────────────────────────

export const IntelDietSchema = z.enum([
  "catalyst",
  "fundamental",
  "flow",
  "macro",
  "calendar",
  "onchain"
])
export type IntelDiet = z.infer<typeof IntelDietSchema>

export const SynthesisBriefTypeSchema = z.enum([
  "catalyst",
  "fundamental",
  "flow",
  "macro",
  "morning",
  "contradiction"
])
export type SynthesisBriefType = z.infer<typeof SynthesisBriefTypeSchema>

export const ProvenanceItemSchema = z.object({
  source: z.string(),
  url: z.string().optional(),
  excerpt: z.string().optional(),
  title: z.string().optional()
})

export const IntelDocumentSchema = z.object({
  id: z.string(),
  diet: IntelDietSchema,
  source: z.string(),
  externalId: z.string().nullable().optional(),
  symbol: z.string().nullable().optional(),
  symbols: z.array(z.string()),
  title: z.string(),
  body: z.string(),
  url: z.string().nullable().optional(),
  sentiment: z.number().nullable().optional(),
  eventType: z.string().nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime()
})

export type IntelDocument = z.infer<typeof IntelDocumentSchema>

export const SynthesisBriefSchema = z.object({
  id: z.string(),
  briefType: SynthesisBriefTypeSchema,
  symbols: z.array(z.string()),
  headline: z.string(),
  thesis: z.string(),
  bullets: z.object({
    bullish: z.array(z.string()).optional(),
    bearish: z.array(z.string()).optional(),
    actionable: z.array(z.string()).optional()
  }),
  impactScore: z.number().int().min(1).max(10),
  confidence: z.number().min(0).max(1),
  provenance: z.array(ProvenanceItemSchema),
  analogs: z.array(z.object({
    summary: z.string(),
    return1d: z.number().nullable().optional()
  })).nullable().optional(),
  regime: z.string().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime()
})

export type SynthesisBrief = z.infer<typeof SynthesisBriefSchema>

export const CatalystRadarItemSchema = z.object({
  symbol: z.string(),
  heat: z.number().min(-1).max(1),
  impactScore: z.number().int(),
  headline: z.string(),
  briefId: z.string().optional(),
  sentiment: z.number().optional(),
  change24h: z.number().optional()
})

export type CatalystRadarItem = z.infer<typeof CatalystRadarItemSchema>

export const ContradictionAlertSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  newsBias: z.string(),
  flowBias: z.string().nullable().optional(),
  technicalBias: z.string().nullable().optional(),
  summary: z.string(),
  severity: z.number().int(),
  createdAt: z.string().datetime()
})

export type ContradictionAlert = z.infer<typeof ContradictionAlertSchema>

export const EntityGraphNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  symbol: z.string().nullable().optional()
})

export const EntityGraphEdgeSchema = z.object({
  id: z.string(),
  fromId: z.string(),
  toId: z.string(),
  relation: z.string(),
  weight: z.number()
})

export const RippleGraphSchema = z.object({
  nodes: z.array(EntityGraphNodeSchema),
  edges: z.array(EntityGraphEdgeSchema),
  rootSymbol: z.string().optional()
})

export type RippleGraph = z.infer<typeof RippleGraphSchema>

export const ConvictionDashboardSchema = z.object({
  symbol: z.string(),
  score: z.number().min(0).max(100),
  diets: z.record(z.number()),
  headline: z.string().optional(),
  briefId: z.string().optional()
})

export type ConvictionDashboard = z.infer<typeof ConvictionDashboardSchema>

export * from "./knowledge"
