import { Type } from "@google/genai";
import {
  runWorkflow,
  buildWorkflowCatalogForPrompt,
} from "@/lib/skills/workflow-runner";
import type { SkillExecutionContext } from "@/lib/skills/executor";
import { buildWorkflowResultGenui } from "@/lib/skills/workflow-genui";

const WORKFLOW_CATALOG = buildWorkflowCatalogForPrompt();

export const executeWorkflowDeclaration = {
  name: "execute_workflow",
  description: `Run a multi-step trading analysis workflow (YAML orchestration from claude-trading-skills).

Available workflows:
${WORKFLOW_CATALOG}

Each workflow runs skills in sequence, passing artifacts between steps. Use for structured daily/weekly analysis routines.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      workflow_id: {
        type: Type.STRING,
        description: "Workflow id e.g. market-regime-daily, swing-opportunity-daily",
      },
      inputs: {
        type: Type.OBJECT,
        description: "Optional inputs passed to first steps (symbols, timeframes, etc.)",
      },
    },
    required: ["workflow_id"],
  },
};

export async function handleExecuteWorkflow(params: {
  workflow_id: string;
  inputs?: Record<string, unknown>;
  userId: string;
  goalId?: string;
  mode: SkillExecutionContext["mode"];
  accountBalance?: number;
}) {
  const context: SkillExecutionContext = {
    userId: params.userId,
    goalId: params.goalId ?? "",
    mode: params.mode,
    accountBalance: params.accountBalance,
  };

  const result = await runWorkflow(params.workflow_id, context, params.inputs ?? {});

  if (!result.success) {
    return {
      ...result,
      success: false,
      tool_error: true,
      message: result.error ?? "Workflow failed",
    };
  }

  return { ...result, genui: buildWorkflowResultGenui(result) };
}
