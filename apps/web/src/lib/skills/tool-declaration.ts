/**
 * AI Tool Declaration for Skill Execution
 * Add this to apps/web/src/app/api/chat/route.ts
 */

import { Type } from "@google/genai";
import { getSkillExecutor, type SkillExecutionContext } from "@/lib/skills/executor";
import { buildSkillCatalogForPrompt } from "@/lib/skills/tool-library";

const SKILL_CATALOG = buildSkillCatalogForPrompt(50);

/**
 * Tool declaration for execute_skill
 * Add to your tool declarations array in route.ts
 */
export const executeSkillDeclaration = {
  name: "execute_skill",
  description: `Execute a trading analysis skill to enhance decision-making.

Mapped skills (native + external libraries):
${SKILL_CATALOG}

Skills provide specialized analysis beyond base knowledge. Use them for:
- Market context (regime, volatility, trends)
- Risk management (sizing, portfolio heat)
- Technical analysis (patterns, levels, strength)
- Strategy selection (based on regime)
- Guidance-only skills return a workflow — follow it with suggested companion tools`,
  
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
    required: ["skill_id"],
  },
};

/**
 * Handler for execute_skill tool calls
 * Add to your tool execution switch statement in route.ts
 */
export function normalizeSkillToolArgs(
  args: Record<string, unknown>,
): { skill_id: string; inputs: Record<string, unknown> } {
  const skill_id = String(args.skill_id ?? "");
  const nested = args.inputs;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return { skill_id, inputs: nested as Record<string, unknown> };
  }

  const { skill_id: _id, inputs: _inputs, ...rest } = args;
  return { skill_id, inputs: rest };
}

export async function handleExecuteSkill(params: {
  skill_id: string;
  inputs: Record<string, unknown>;
  userId: string;
  goalId: string;
  mode: string;
  accountBalance?: number;
}) {
  const executor = await getSkillExecutor();

  const context: SkillExecutionContext = {
    userId: params.userId,
    goalId: params.goalId,
    mode: params.mode as SkillExecutionContext["mode"],
    accountBalance: params.accountBalance,
  };

  const result = await executor.executeSkill(
    params.skill_id,
    params.inputs,
    context,
  );

  if (!result.success) {
    return {
      error: true,
      message: `Skill execution failed: ${result.error}`,
    };
  }

  const payload: Record<string, unknown> = {
    success: true,
    skill_id: params.skill_id,
    data: result.data,
    execution_time_ms: result.execution_time_ms,
    cached: result.cached || false,
  };

  const data = result.data as { mode?: string; workflow?: string; skill_id?: string } | undefined;
  if (data?.mode === "guidance" && data.workflow) {
    payload.genui = {
      view: [
        {
          type: "callout",
          variant: "info",
          title: `Skill workflow · ${params.skill_id}`,
          text: String(data.workflow).slice(0, 400) + (String(data.workflow).length > 400 ? "…" : ""),
        },
      ],
    };
  }

  return payload;
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
