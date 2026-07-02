/**
 * Skills Executor - Core infrastructure for AI trading skills
 * Based on tradermonty/claude-trading-skills architecture patterns
 * Integrates skills into Wealth Monitor and Command AI
 */

import { readFile } from "fs/promises";
import { join } from "path";
import YAML from "yaml";
import type { TradingMode } from "@/lib/chat/conversation-persistence";
import { resolveSkillsPath } from "@/lib/skills/resolve-skills-path";
import { buildSkillGuidancePrompt, loadSkillDocument } from "@/lib/skills/skill-library";
import { getSkillToolMapping } from "@/lib/skills/tool-library";

const BUILTIN_SKILL_IDS = new Set([
  "market-regime-detector",
  "position-sizer",
  "portfolio-heat-calculator",
  "pattern-lookup",
  "strategy-recommender",
  "tradingview-chart-analyst",
]);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SkillMetadata {
  id: string;
  name: string;
  category: string;
  status: "production" | "beta" | "experimental" | "planned";
  autonomous: boolean;
  priority: number;
  description: string;
  triggers?: string[];
  integrations: {
    data_required: string[];
    knowledge_refs?: string[];
  };
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  workflows?: string[];
}

export interface SkillExecutionContext {
  userId: string;
  goalId: string;
  mode: TradingMode;
  cycleId?: string;
  accountBalance?: number;
}

export interface SkillExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  execution_time_ms: number;
  skill_id: string;
  cached?: boolean;
}

export interface SkillCacheEntry {
  result: SkillExecutionResult;
  timestamp: number;
  expiresAt: number;
}

// ============================================================================
// SKILL EXECUTOR CLASS
// ============================================================================

export class SkillExecutor {
  private skillsRegistry: Map<string, SkillMetadata> = new Map();
  private skillsPath: string;
  private cache: Map<string, SkillCacheEntry> = new Map();
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  constructor(skillsPath?: string) {
    this.skillsPath = skillsPath || resolveSkillsPath();
  }

  private isRunnableSkill(metadata: SkillMetadata): boolean {
    if (metadata.status === "production" || metadata.status === "beta") {
      return true;
    }
    if (BUILTIN_SKILL_IDS.has(metadata.id)) {
      return true;
    }
    return getSkillToolMapping(metadata.id) != null;
  }

  /**
   * Load skills registry from skills-index.yaml
   */
  async loadRegistry(): Promise<void> {
    const registryPath = join(this.skillsPath, "skills-index.yaml");
    
    try {
      const registryContent = await readFile(registryPath, "utf-8");
      const registry = YAML.parse(registryContent);

      if (!registry.skills || !Array.isArray(registry.skills)) {
        throw new Error("Invalid skills registry format");
      }

      for (const skill of registry.skills) {
        this.skillsRegistry.set(skill.id, skill);
      }

      console.log(`[SkillExecutor] Loaded ${this.skillsRegistry.size} skills from registry`);
    } catch (error) {
      console.error(`[SkillExecutor] Failed to load registry:`, error);
      throw new Error(`Failed to load skills registry: ${error}`);
    }
  }

  /**
   * Execute a skill with given inputs
   */
  async executeSkill(
    skillId: string,
    inputs: any,
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = this.getCacheKey(skillId, inputs);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log(`[SkillExecutor] Cache hit for ${skillId}`);
        return { ...cached, cached: true };
      }

      // Get skill metadata (native registry or external SKILL.md)
      const metadata = await this.resolveSkillMetadata(skillId);
      if (!metadata) {
        return {
          success: false,
          error: `Skill not found: ${skillId}`,
          execution_time_ms: Date.now() - startTime,
          skill_id: skillId,
        };
      }

      if (!this.isRunnableSkill(metadata)) {
        return {
          success: false,
          error: `Skill ${skillId} is in ${metadata.status} status and has no implementation`,
          execution_time_ms: Date.now() - startTime,
          skill_id: skillId,
        };
      }

      console.log(`[SkillExecutor] Executing skill: ${skillId}`);

      // Execute skill based on type
      const result = await this.executeSkillImplementation(
        metadata,
        inputs,
        context
      );

      const executionResult: SkillExecutionResult = {
        success: true,
        data: result,
        execution_time_ms: Date.now() - startTime,
        skill_id: skillId,
      };

      // Cache result
      this.setCache(cacheKey, executionResult);

      console.log(
        `[SkillExecutor] ✓ ${skillId} completed in ${executionResult.execution_time_ms}ms`
      );

      return executionResult;
    } catch (error) {
      console.error(`[SkillExecutor] ✗ ${skillId} failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        execution_time_ms: Date.now() - startTime,
        skill_id: skillId,
      };
    }
  }

  /**
   * Resolve skill from native registry or external skill library.
   */
  private async resolveSkillMetadata(skillId: string): Promise<SkillMetadata | null> {
    const fromRegistry = this.skillsRegistry.get(skillId);
    if (fromRegistry) return fromRegistry;

    const doc = await loadSkillDocument(skillId);
    if (!doc) return null;

    const mapping = getSkillToolMapping(skillId);
    return {
      id: doc.id,
      name: doc.name,
      category: doc.category,
      status: mapping?.mode === "native" ? "production" : "beta",
      autonomous: false,
      priority: 50,
      description: doc.description,
      integrations: {
        data_required: mapping?.companionTools ?? [],
      },
    };
  }

  /**
   * Execute skill implementation - routes to appropriate executor
   */
  private async executeSkillImplementation(
    metadata: SkillMetadata,
    inputs: any,
    context: SkillExecutionContext
  ): Promise<any> {
    // Route to specialized executors based on skill category/ID
    switch (metadata.id) {
      case "market-regime-detector":
        return this.executeMarketRegimeDetector(inputs, context);
      
      case "position-sizer":
        return this.executePositionSizer(inputs, context);
      
      case "portfolio-heat-calculator":
        return this.executePortfolioHeatCalculator(inputs, context);
      
      case "pattern-lookup":
        return this.executePatternLookup(inputs, context);
      
      case "strategy-recommender":
        return this.executeStrategyRecommender(inputs, context);

      case "tradingview-chart-analyst":
        return this.executeTradingViewChartAnalyst(inputs, context);

      case "workspace-chart-analyst":
        return this.executeTradingViewChartAnalyst(
          { ...inputs, embedChartInChat: false },
          context,
        );
      
      default:
        // Try to load and execute custom script
        return this.executeCustomScript(metadata, inputs, context);
    }
  }

  /**
   * Market Regime Detector implementation
   */
  private async executeMarketRegimeDetector(
    inputs: { symbols?: string[]; timeframes?: string[] },
    context: SkillExecutionContext
  ): Promise<any> {
    const symbols = inputs.symbols || ["SPY", "QQQ", "BTCUSD"];
    const timeframes = inputs.timeframes || ["1D"];

    // Import capitalAdapter dynamically to avoid build issues
    const { capitalAdapter } = await import("@/lib/execution/capital-adapter");

    // Fetch candles from Capital.com for each symbol
    const symbolAnalyses = await Promise.all(
      symbols.map(async (symbol) => {
        try {
    // Fetch 1D candles (200 bars for moving averages)
          const candles = await capitalAdapter.fetchCandles(
            symbol,
            "crypto", // asset class - could be inferred
            200, // rangeDays
          );

          if (!candles || candles.length < 200) {
            return { symbol, regime: "ranging", score: 0, error: "Insufficient data" };
          }

          // Calculate indicators
          const closes = candles.map((c) => c.c);
          const highs = candles.map((c) => c.h);
          const lows = candles.map((c) => c.l);

          const sma20 = this.calculateSMA(closes, 20);
          const sma50 = this.calculateSMA(closes, 50);
          const sma200 = this.calculateSMA(closes, 200);

          const currentPrice = closes[closes.length - 1];

          // Scoring logic (5 criteria)
          let score = 0;

          // 1. Price vs 200 SMA
          score += currentPrice > sma200[sma200.length - 1] ? 1 : -1;

          // 2. MA Alignment
          const bullishAlignment =
            sma20[sma20.length - 1] > sma50[sma50.length - 1] &&
            sma50[sma50.length - 1] > sma200[sma200.length - 1];
          const bearishAlignment =
            sma20[sma20.length - 1] < sma50[sma50.length - 1] &&
            sma50[sma50.length - 1] < sma200[sma200.length - 1];
          score += bullishAlignment ? 1 : bearishAlignment ? -1 : 0;

          // 3. ADX (simplified - use recent slope as proxy)
          const recentSlope =
            (closes[closes.length - 1] - closes[closes.length - 20]) /
            closes[closes.length - 20];
          if (Math.abs(recentSlope) > 0.05) {
            // Strong trend
            score += recentSlope > 0 ? 1 : -1;
          }

          // 4. Higher Highs / Lower Lows
          const hhllScore = this.detectHigherHighsLowerLows(highs, lows, 20);
          score += hhllScore;

          // 5. Weekly confirmation (if requested)
          if (timeframes.includes("1W")) {
            // Simplified: if daily trend is strong, assume weekly confirms
            if (Math.abs(score) >= 3) {
              score += Math.sign(score);
            }
          }

          // Classify regime
          let regime: "uptrend" | "downtrend" | "ranging";
          if (score >= 3) regime = "uptrend";
          else if (score <= -3) regime = "downtrend";
          else regime = "ranging";

          return {
            symbol,
            regime,
            score,
            details: {
              price: currentPrice,
              sma20: sma20[sma20.length - 1],
              sma50: sma50[sma50.length - 1],
              sma200: sma200[sma200.length - 1],
            },
          };
        } catch (error) {
          console.error(`[MarketRegimeDetector] Error for ${symbol}:`, error);
          return { symbol, regime: "ranging", score: 0, error: String(error) };
        }
      })
    );

    // Aggregate breadth
    const uptrendCount = symbolAnalyses.filter((s) => s.regime === "uptrend").length;
    const downtrendCount = symbolAnalyses.filter((s) => s.regime === "downtrend").length;

    let overallRegime: "uptrend" | "downtrend" | "ranging";
    if (uptrendCount >= 2) overallRegime = "uptrend";
    else if (downtrendCount >= 2) overallRegime = "downtrend";
    else overallRegime = "ranging";

    const maxAgreement = Math.max(uptrendCount, downtrendCount, symbols.length - uptrendCount - downtrendCount);
    const confidence = Math.round((maxAgreement / symbols.length) * 100);

    // Generate reasoning
    const reasoning = symbolAnalyses
      .map((s) => {
        const priceVsSMA = s.details
          ? s.details.price > s.details.sma200
            ? "above"
            : "below"
          : "unknown";
        return `${s.symbol}: ${s.regime.toUpperCase()} (score ${s.score}) - Price ${priceVsSMA} 200 SMA`;
      })
      .join("\n");

    // Recommend strategy
    const recommended_strategy =
      overallRegime === "uptrend"
        ? confidence >= 70
          ? "Trend Following (Aggressive)"
          : "Trend Following (Cautious)"
        : overallRegime === "downtrend"
        ? confidence >= 70
          ? "Short-Only or Stay Flat"
          : "Defensive Positioning"
        : "Mean Reversion / Range Trading";

    return {
      regime: overallRegime,
      confidence,
      reasoning,
      recommended_strategy,
      symbol_breakdown: symbolAnalyses,
      next_review: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  /**
   * Position Sizer implementation
   */
  private async executePositionSizer(
    inputs: {
      symbol?: string;
      entry_price?: number;
      stop_loss?: number;
      account_balance?: number;
      max_risk_pct?: number;
      direction?: "BUY" | "SELL";
    },
    context: SkillExecutionContext
  ): Promise<any> {
    const entryPrice = Number(inputs.entry_price);
    if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
      throw new Error("position-sizer requires a valid entry_price");
    }

    const accountBalance = inputs.account_balance || context.accountBalance || 10000;
    const maxRiskPct = inputs.max_risk_pct || 2;

    let stopLoss = inputs.stop_loss != null ? Number(inputs.stop_loss) : NaN;
    if (!Number.isFinite(stopLoss)) {
      const isShort = inputs.direction === "SELL";
      stopLoss = isShort ? entryPrice * 1.02 : entryPrice * 0.98;
    }

    const riskPerShare = Math.abs(entryPrice - stopLoss);
    if (!Number.isFinite(riskPerShare) || riskPerShare <= 0) {
      throw new Error("position-sizer requires a valid stop_loss distinct from entry_price");
    }

    const maxRiskDollars = accountBalance * (maxRiskPct / 100);
    const units = Math.floor(maxRiskDollars / riskPerShare);

    const marginRequired = units * entryPrice;
    const riskDollars = units * riskPerShare;
    const riskPct = (riskDollars / accountBalance) * 100;

    return {
      symbol: inputs.symbol ?? null,
      units,
      margin_required: marginRequired,
      risk_dollars: riskDollars,
      risk_pct: riskPct,
      entry_price: entryPrice,
      stop_loss: stopLoss,
      stop_loss_inferred: inputs.stop_loss == null,
      risk_per_share: riskPerShare,
      account_balance: accountBalance,
      max_risk_pct: maxRiskPct,
    };
  }

  /**
   * Portfolio Heat Calculator implementation
   */
  private async executePortfolioHeatCalculator(
    inputs: { positions?: any[] },
    context: SkillExecutionContext
  ): Promise<any> {
    // Import capitalAdapter dynamically
    const { capitalAdapter } = await import("@/lib/execution/capital-adapter");

    // Fetch current positions from Capital.com
    const positions = await capitalAdapter.getOpenPositions();

    if (!positions || positions.length === 0) {
      return {
        total_risk_pct: 0,
        num_positions: 0,
        risk_by_symbol: {},
        message: "No open positions",
      };
    }

    // Calculate risk for each position
    const riskBySymbol: Record<string, number> = {};
    let totalRiskDollars = 0;

    for (const position of positions) {
      // Estimate risk as (size * abs(current_price - stop_loss))
      // For simplicity, assume stop is 5% below entry for longs
      const entryLevel = position.entryPrice;
      const stopDistance = Math.abs(entryLevel) * 0.05;
      const riskDollars = position.size * stopDistance;
      
      riskBySymbol[position.epic] = riskDollars;
      totalRiskDollars += riskDollars;
    }

    const accountBalance = context.accountBalance || 10000;
    const totalRiskPct = (totalRiskDollars / accountBalance) * 100;

    return {
      total_risk_pct: totalRiskPct,
      num_positions: positions.length,
      risk_by_symbol: riskBySymbol,
      total_risk_dollars: totalRiskDollars,
      account_balance: accountBalance,
    };
  }

  /**
   * Pattern Lookup - Query knowledge base
   */
  private async executePatternLookup(
    inputs: { pattern_type?: string },
    context: SkillExecutionContext
  ): Promise<any> {
    // Load chart-patterns.json from knowledge base
    try {
      const knowledgePath = join(
        process.cwd(),
        "../..",
        "knowledge-base",
        "reference",
        "chart-patterns.json"
      );
      const patternsContent = await readFile(knowledgePath, "utf-8");
      const patterns = JSON.parse(patternsContent);

      if (inputs.pattern_type) {
        const found = patterns[inputs.pattern_type];
        return found || { error: "Pattern not found" };
      }

      return patterns;
    } catch (error) {
      return { error: "Failed to load chart patterns", details: String(error) };
    }
  }

  /**
   * Strategy Recommender - Based on regime
   */
  private async executeStrategyRecommender(
    inputs: { regime?: string; confidence?: number },
    context: SkillExecutionContext
  ): Promise<any> {
    const regime = inputs.regime || "ranging";
    const confidence = inputs.confidence || 50;

    // Load strategies.json from knowledge base
    try {
      const knowledgePath = join(
        process.cwd(),
        "../..",
        "knowledge-base",
        "reference",
        "strategies.json"
      );
      const strategiesContent = await readFile(knowledgePath, "utf-8");
      const strategies = JSON.parse(strategiesContent);

      const regimeStrategies = strategies[regime] || [];

      return {
        regime,
        confidence,
        recommended_strategies: regimeStrategies,
        primary_strategy: regimeStrategies[0],
      };
    } catch (error) {
      return { error: "Failed to load strategies", details: String(error) };
    }
  }

  /**
   * TradingView Chart Analyst — visual TA via TradingView + Gemini vision
   */
  private async executeTradingViewChartAnalyst(
    inputs: {
      symbols?: string[];
      symbol?: string;
      interval?: string;
      indicators?: string[];
      range?: string;
      style?: string;
      embedChartInChat?: boolean;
    },
    context: SkillExecutionContext
  ): Promise<any> {
    const { executeTradingViewChartAnalyst } = await import(
      "@/lib/chart/analyze-chart-tool"
    );
    const symbols = inputs.symbols?.length
      ? inputs.symbols
      : inputs.symbol
        ? [String(inputs.symbol)]
        : undefined;
    return executeTradingViewChartAnalyst({
      symbols,
      interval: inputs.interval,
      indicators: inputs.indicators,
      range: inputs.range,
      style: inputs.style,
      userId: context.userId,
      embedChartInChat: inputs.embedChartInChat,
    });
  }

  /**
   * Execute custom skill script (for future extensibility)
   */
  private async executeCustomScript(
    metadata: SkillMetadata,
    inputs: Record<string, unknown>,
    context: SkillExecutionContext
  ): Promise<unknown> {
    const mapping = getSkillToolMapping(metadata.id);

    if (mapping?.mode === "tool" && mapping.tool === "analyze_chart") {
      const symbols = Array.isArray(inputs.symbols)
        ? (inputs.symbols as string[])
        : inputs.symbol
          ? [String(inputs.symbol)]
          : undefined;
      return this.executeTradingViewChartAnalyst(
        {
          symbols,
          interval: inputs.interval as string | undefined,
          indicators: inputs.indicators as string[] | undefined,
        },
        context,
      );
    }

    if (mapping?.mode === "tool" && mapping.tool === "get_macro_data") {
      const { fetchMacroData } = await import("@/lib/chat/tools/macro-tools");
      return fetchMacroData();
    }

    if (mapping?.mode === "tool" && mapping.tool === "get_fundamentals") {
      const { fetchFundamentals } = await import("@/lib/chat/tools/macro-tools");
      return fetchFundamentals(String(inputs.symbol ?? ""));
    }

    const guidance = await buildSkillGuidancePrompt(metadata.id);
    if (guidance) {
      return {
        mode: "guidance",
        skill_id: metadata.id,
        workflow: guidance,
        suggested_tools: mapping?.companionTools ?? [],
        inputs,
        note: "Follow this skill workflow using the suggested tools. Do not invent data.",
      };
    }

    throw new Error(`No implementation for skill ${metadata.id}`);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private calculateSMA(data: number[], period: number): number[] {
    const sma: number[] = [];
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    return sma;
  }

  private detectHigherHighsLowerLows(
    highs: number[],
    lows: number[],
    lookback: number
  ): number {
    const recentHighs = highs.slice(-lookback);
    const recentLows = lows.slice(-lookback);

    const lastHigh = recentHighs[recentHighs.length - 1];
    const lastLow = recentLows[recentLows.length - 1];

    const prevMaxHigh = Math.max(...recentHighs.slice(0, -1));
    const prevMinLow = Math.min(...recentLows.slice(0, -1));

    const higherHighs = lastHigh > prevMaxHigh;
    const higherLows = lastLow > prevMinLow;

    const lowerHighs = lastHigh < prevMaxHigh;
    const lowerLows = lastLow < prevMinLow;

    if (higherHighs && higherLows) return 1;
    if (lowerHighs && lowerLows) return -1;
    return 0;
  }

  private getCacheKey(skillId: string, inputs: any): string {
    return `${skillId}:${JSON.stringify(inputs)}`;
  }

  private getFromCache(cacheKey: string): SkillExecutionResult | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;
    
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(cacheKey);
      return null;
    }
    
    return cached.result;
  }

  private setCache(cacheKey: string, result: SkillExecutionResult): void {
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });
  }

  /**
   * Get skill metadata
   */
  getSkillMetadata(skillId: string): SkillMetadata | undefined {
    return this.skillsRegistry.get(skillId);
  }

  /**
   * List skills with optional filtering
   */
  listSkills(filter?: {
    category?: string;
    autonomous?: boolean;
    status?: string;
  }): SkillMetadata[] {
    let skills = Array.from(this.skillsRegistry.values());

    if (filter?.category) {
      skills = skills.filter((s) => s.category === filter.category);
    }

    if (filter?.autonomous !== undefined) {
      skills = skills.filter((s) => s.autonomous === filter.autonomous);
    }

    if (filter?.status) {
      skills = skills.filter((s) => s.status === filter.status);
    }

    return skills.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get autonomous skills for a cycle (top 5 by priority)
   */
  getAutonomousSkills(limit: number = 5): SkillMetadata[] {
    return this.listSkills({ autonomous: true, status: "production" }).slice(
      0,
      limit
    );
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let executorInstance: SkillExecutor | null = null;

export async function getSkillExecutor(): Promise<SkillExecutor> {
  if (!executorInstance) {
    executorInstance = new SkillExecutor();
    await executorInstance.loadRegistry();
  }
  return executorInstance;
}

/**
 * Execute multiple skills in parallel
 */
export async function executeSkillsParallel(
  skillIds: string[],
  inputs: Record<string, any>,
  context: SkillExecutionContext
): Promise<Record<string, SkillExecutionResult>> {
  const executor = await getSkillExecutor();
  
  const results = await Promise.all(
    skillIds.map(async (skillId) => {
      const result = await executor.executeSkill(
        skillId,
        inputs[skillId] || {},
        context
      );
      return [skillId, result] as [string, SkillExecutionResult];
    })
  );

  return Object.fromEntries(results);
}
