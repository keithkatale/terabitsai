/**
 * Wealth Monitor Integration with Skills
 * Extends wealth-monitor.ts to execute autonomous skills during each cycle
 */

import { getSkillExecutor, type SkillExecutionContext } from "@/lib/skills/executor";
import type { TradingMode } from "@/lib/chat/conversation-persistence";

/**
 * Execute autonomous skills for this monitor cycle
 * Returns skill results that can be included in the directive
 */
export async function executeAutonomousSkills(params: {
  userId: string;
  goalId: string;
  mode: TradingMode;
  cycleId: string;
  accountBalance: number;
}): Promise<Record<string, any>> {
  const executor = await getSkillExecutor();
  
  // Get top priority autonomous skills
  const autonomousSkills = executor.getAutonomousSkills(5); // Top 5
  
  console.log(
    `[Monitor] Executing ${autonomousSkills.length} autonomous skills:`,
    autonomousSkills.map((s) => s.id)
  );

  const context: SkillExecutionContext = {
    userId: params.userId,
    goalId: params.goalId,
    mode: params.mode,
    cycleId: params.cycleId,
    accountBalance: params.accountBalance,
  };

  const skillResults: Record<string, any> = {};

  // Execute skills in priority order
  for (const skillMetadata of autonomousSkills) {
    try {
      console.log(`[Monitor] → Executing: ${skillMetadata.id}`);
      
      // Prepare inputs based on skill type
      const inputs = prepareSkillInputs(skillMetadata.id, params);
      
      const result = await executor.executeSkill(
        skillMetadata.id,
        inputs,
        context
      );

      if (result.success) {
        skillResults[skillMetadata.id] = result.data;
        console.log(
          `[Monitor] ✓ ${skillMetadata.id} completed in ${result.execution_time_ms}ms`
        );
      } else {
        console.error(`[Monitor] ✗ ${skillMetadata.id} failed: ${result.error}`);
        skillResults[skillMetadata.id] = { error: result.error };
      }
    } catch (error) {
      console.error(`[Monitor] Error executing ${skillMetadata.id}:`, error);
      skillResults[skillMetadata.id] = { error: String(error) };
    }
  }

  return skillResults;
}

/**
 * Prepare inputs for specific skills
 */
function prepareSkillInputs(
  skillId: string,
  params: {
    userId: string;
    goalId: string;
    mode: TradingMode;
    accountBalance: number;
  }
): any {
  switch (skillId) {
    case "market-regime-detector":
      return {
        symbols: ["SPY", "QQQ", "BTCUSD"],
        timeframes: ["1D", "1W"],
      };

    case "position-sizer":
      // Position sizer needs specific trade parameters
      // Will be called on-demand per trade, not in monitor cycle
      return {};

    case "portfolio-heat-calculator":
      return {
        // Positions will be fetched internally
      };

    case "pattern-lookup":
      return {
        // Pattern type will be specified by AI
      };

    case "strategy-recommender":
      return {
        // Regime will be passed from market-regime-detector result
      };

    default:
      return {};
  }
}

/**
 * Format skill results for inclusion in monitor directive
 */
export function formatSkillResultsForDirective(
  skillResults: Record<string, any>
): string {
  const sections: string[] = [];

  // Market Regime
  if (skillResults["market-regime-detector"]) {
    const regime = skillResults["market-regime-detector"];
    sections.push(`## Market Regime Analysis

**Regime:** ${regime.regime?.toUpperCase() || "Unknown"} (${regime.confidence || 0}% confidence)

${regime.reasoning || "No reasoning available"}

**Recommended Strategy:** ${regime.recommended_strategy || "N/A"}
`);
  }

  // Portfolio Heat
  if (skillResults["portfolio-heat-calculator"]) {
    const heat = skillResults["portfolio-heat-calculator"];
    sections.push(`## Portfolio Risk Analysis

**Total Heat:** ${heat.total_risk_pct?.toFixed(1) || 0}% of account
**Open Positions:** ${heat.num_positions || 0}
**Total Risk:** $${heat.total_risk_dollars?.toFixed(2) || 0}
`);
  }

  // Pattern Lookup (if used)
  if (skillResults["pattern-lookup"] && !skillResults["pattern-lookup"].error) {
    sections.push(`## Chart Pattern Reference

Pattern data available for analysis.
`);
  }

  // Strategy Recommender
  if (skillResults["strategy-recommender"]) {
    const strategy = skillResults["strategy-recommender"];
    if (!strategy.error) {
      sections.push(`## Strategy Recommendation

**Primary Strategy:** ${strategy.primary_strategy || "N/A"}
**Based on:** ${strategy.regime || "Unknown"} regime
`);
    }
  }

  return sections.join("\n");
}

/**
 * Determine if new trades should be allowed based on skill results
 */
export function shouldAllowNewTrades(skillResults: Record<string, any>): {
  allowed: boolean;
  reason: string;
} {
  // Check portfolio heat
  const heat = skillResults["portfolio-heat-calculator"];
  if (heat && heat.total_risk_pct > 80) {
    return {
      allowed: false,
      reason: `Portfolio heat at ${heat.total_risk_pct.toFixed(1)}% - too high for new entries`,
    };
  }

  // Check market regime
  const regime = skillResults["market-regime-detector"];
  if (regime && regime.regime === "downtrend" && regime.confidence > 70) {
    return {
      allowed: false,
      reason: `Strong downtrend (${regime.confidence}% confidence) - stay defensive`,
    };
  }

  return {
    allowed: true,
    reason: "Risk parameters within limits",
  };
}
