/**
 * AI Tool Declaration for Skill Execution
 * Add this to apps/web/src/app/api/chat/route.ts
 */

import { Type } from "@google-cloud/vertexai";
import { getSkillExecutor, type SkillExecutionContext } from "@/lib/skills/executor";

/**
 * Tool declaration for execute_skill
 * Add to your tool declarations array in route.ts
 */
export const executeSkillDeclaration = {
  name: "execute_skill",
  description: `Execute a trading analysis skill to enhance decision-making.

Available skills:
- market-regime-detector: Classify market as uptrend/downtrend/ranging (symbols, timeframes)
- position-sizer: Calculate risk-based position size (symbol, entry_price, stop_loss, account_balance, max_risk_pct)
- portfolio-heat-calculator: Sum total risk across all open positions ()
- multi-timeframe-analyzer: Analyze trend alignment across timeframes (symbol, timeframes)
- support-resistance-identifier: Find key price levels (symbol, timeframe, lookback)
- trend-strength-scorer: Score trend quality 0-100 (symbol, timeframe)
- pattern-lookup: Query chart patterns from knowledge base (pattern_type)
- strategy-recommender: Get regime-specific strategies (regime, confidence)

Skills provide specialized analysis beyond base knowledge. Use them for:
- Market context (regime, volatility, trends)
- Risk management (sizing, portfolio heat)
- Technical analysis (patterns, levels, strength)
- Strategy selection (based on regime)`,
  
  parameters: {
    type: Type.OBJECT,
    properties: {
      skill_id: {
        type: Type.STRING,
        description: "ID of the skill to execute (e.g., 'market-regime-detector')",
      },
      inputs: {
        type: Type.OBJECT,
        description: "Skill-specific input parameters (see skill documentation)",
      },
    },
    required: ["skill_id", "inputs"],
  },
};

/**
 * Handler for execute_skill tool calls
 * Add to your tool execution switch statement in route.ts
 */
export async function handleExecuteSkill(params: {
  skill_id: string;
  inputs: any;
  userId: string;
  goalId: string;
  mode: string;
  accountBalance?: number;
}) {
  const executor = await getSkillExecutor();

  const context: SkillExecutionContext = {
    userId: params.userId,
    goalId: params.goalId,
    mode: params.mode as any,
    accountBalance: params.accountBalance,
  };

  const result = await executor.executeSkill(
    params.skill_id,
    params.inputs,
    context
  );

  if (!result.success) {
    return {
      error: true,
      message: `Skill execution failed: ${result.error}`,
    };
  }

  return {
    success: true,
    skill_id: params.skill_id,
    data: result.data,
    execution_time_ms: result.execution_time_ms,
    cached: result.cached || false,
  };
}

/**
 * Example integration in route.ts:
 * 
 * // 1. Add to imports
 * import { executeSkillDeclaration, handleExecuteSkill } from "@/lib/skills/tool-declaration";
 * 
 * // 2. Add to tool declarations array
 * const tools = [
 *   brokerActionDeclaration,
 *   accountStateDeclaration,
 *   executeSkillDeclaration, // NEW
 *   // ... other tools
 * ];
 * 
 * // 3. Add to tool execution switch
 * if (name === "execute_skill") {
 *   const { skill_id, inputs } = fnArgs as { skill_id: string; inputs: any };
 *   
 *   const result = await handleExecuteSkill({
 *     skill_id,
 *     inputs,
 *     userId: session.user.id,
 *     goalId: activeGoalId,
 *     mode,
 *     accountBalance: accountState?.balance,
 *   });
 *   
 *   if (result.error) {
 *     return new Response(
 *       JSON.stringify({
 *         role: "user",
 *         parts: [{ text: result.message }]
 *       }),
 *       { headers: { 'Content-Type': 'application/json' } }
 *     );
 *   }
 *   
 *   return new Response(
 *     JSON.stringify({
 *       role: "user",
 *       parts: [{
 *         functionResponse: {
 *           name: "execute_skill",
 *           response: result.data
 *         }
 *       }]
 *     }),
 *     { headers: { 'Content-Type': 'application/json' } }
 *   );
 * }
 */
