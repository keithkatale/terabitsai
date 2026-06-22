import { z } from "zod"

export const PatternDirectionSchema = z.enum(["bullish", "bearish", "neutral"])
export type PatternDirection = z.infer<typeof PatternDirectionSchema>

export const PatternTypeSchema = z.enum(["reversal", "continuation"])
export type PatternType = z.infer<typeof PatternTypeSchema>

export const StrategyCategorySchema = z.enum([
  "trend",
  "mean_reversion",
  "volatility",
  "arbitrage",
  "execution",
  "psychology",
])
export type StrategyCategory = z.infer<typeof StrategyCategorySchema>

export const MarketRegimeSchema = z.enum(["trending", "ranging", "volatile"])
export type MarketRegime = z.infer<typeof MarketRegimeSchema>

export const EntryRuleSchema = z.object({
  condition: z.string(),
  indicators: z.array(z.string()).optional(),
  confirmation: z.string().optional(),
})
export type EntryRule = z.infer<typeof EntryRuleSchema>

export const ExitRuleSchema = z.object({
  condition: z.string(),
  stop: z.string().optional(),
  target: z.string().optional(),
})
export type ExitRule = z.infer<typeof ExitRuleSchema>

export const ChartPatternSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: PatternTypeSchema,
  direction: PatternDirectionSchema,
  formation: z.array(z.string()),
  entry_rules: z.array(EntryRuleSchema),
  exit_rules: z.array(ExitRuleSchema),
  reliability: z.number().min(0).max(1),
  best_timeframes: z.array(z.string()),
  confirmation_signals: z.array(z.string()),
  source: z.string().optional(),
})
export type ChartPattern = z.infer<typeof ChartPatternSchema>

export const TradingStrategySchema = z.object({
  id: z.string(),
  name: z.string(),
  category: StrategyCategorySchema,
  description: z.string().optional(),
  entry: z.object({
    indicators: z.array(z.string()),
    conditions: z.array(z.string()),
  }),
  exit: z.object({
    stops: z.string(),
    targets: z.string(),
  }),
  win_rate: z.number().min(0).max(1).optional(),
  risk_reward: z.string().optional(),
  markets: z.array(z.string()),
  regime: MarketRegimeSchema,
  source: z.string().optional(),
})
export type TradingStrategy = z.infer<typeof TradingStrategySchema>

export const TradingPsychologySchema = z.object({
  id: z.string(),
  principle: z.string(),
  description: z.string(),
  application: z.string(),
  common_mistakes: z.array(z.string()),
  source: z.string().optional(),
})
export type TradingPsychology = z.infer<typeof TradingPsychologySchema>

export const RiskRuleSchema = z.object({
  id: z.string(),
  trigger: z.string(),
  threshold: z.string().optional(),
  action: z.string(),
  category: z.enum(["per_trade", "daily", "weekly", "drawdown", "leverage", "emergency"]),
})
export type RiskRule = z.infer<typeof RiskRuleSchema>

export const IndicatorSignalsSchema = z.object({
  id: z.string(),
  name: z.string(),
  formula: z.string().optional(),
  parameters: z.record(z.string()).optional(),
  signals: z.record(z.string()),
  best_for: z.array(z.string()).optional(),
  win_rate: z.number().optional(),
  optimal_timeframe: z.array(z.string()).optional(),
  combinations: z.array(z.string()).optional(),
})
export type IndicatorSignals = z.infer<typeof IndicatorSignalsSchema>

export const ElliottWaveRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  wave_type: z.enum(["impulse", "corrective", "principle"]),
  description: z.string(),
  rules: z.array(z.string()),
  fibonacci: z.array(z.string()).optional(),
  market_context: z.enum(["bull", "bear", "both"]).optional(),
})
export type ElliottWaveRule = z.infer<typeof ElliottWaveRuleSchema>

export const ExecutionStrategySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  objective: z.string(),
  parameters: z.record(z.string()).optional(),
  best_for: z.array(z.string()),
  risks: z.array(z.string()).optional(),
})
export type ExecutionStrategy = z.infer<typeof ExecutionStrategySchema>

export const KnowledgeQueryResultSchema = z.object({
  query: z.string(),
  patterns: z.array(ChartPatternSchema).optional(),
  strategies: z.array(TradingStrategySchema).optional(),
  psychology: z.array(TradingPsychologySchema).optional(),
  riskRules: z.array(RiskRuleSchema).optional(),
  indicators: z.array(IndicatorSignalsSchema).optional(),
  ragExcerpts: z
    .array(
      z.object({
        title: z.string(),
        content: z.string(),
        filePath: z.string(),
        score: z.number().optional(),
      }),
    )
    .optional(),
})
export type KnowledgeQueryResult = z.infer<typeof KnowledgeQueryResultSchema>
