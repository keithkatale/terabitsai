/**
 * YAML workflow runner for claude-trading-skills _workflows/.
 * Executes steps sequentially via SkillExecutor; returns artifacts for LLM synthesis.
 */
import { readFile } from "fs/promises";
import { join } from "path";
import YAML from "yaml";
import { resolveSkillsPath } from "./resolve-skills-path";
import { getSkillExecutor, type SkillExecutionContext } from "./executor";

export type WorkflowStep = {
  step: number;
  name: string;
  skill: string;
  optional?: boolean;
  produces?: string[];
  consumes?: string[];
  decision_gate?: boolean;
  decision_question?: string;
};

export type WorkflowDefinition = {
  id: string;
  display_name: string;
  cadence?: string;
  when_to_run?: string;
  when_not_to_run?: string;
  required_skills?: string[];
  optional_skills?: string[];
  steps: WorkflowStep[];
};

export type WorkflowRunResult = {
  success: boolean;
  workflow_id: string;
  display_name: string;
  steps_completed: number;
  artifacts: Record<string, unknown>;
  step_results: Array<{
    step: number;
    name: string;
    skill: string;
    success: boolean;
    error?: string;
    data?: unknown;
  }>;
  guidance?: string;
  error?: string;
};

const WORKFLOWS_DIR = "_workflows";

export async function loadWorkflow(workflowId: string): Promise<WorkflowDefinition | null> {
  const base = join(resolveSkillsPath(), "external/claude-trading-skills", WORKFLOWS_DIR);
  const path = join(base, `${workflowId}.yaml`);
  try {
    const raw = await readFile(path, "utf8");
    const doc = YAML.parse(raw) as WorkflowDefinition;
    if (!doc?.id || !Array.isArray(doc.steps)) return null;
    return doc;
  } catch {
    return null;
  }
}

export async function listWorkflowIds(): Promise<string[]> {
  const { readdir } = await import("fs/promises");
  const base = join(resolveSkillsPath(), "external/claude-trading-skills", WORKFLOWS_DIR);
  try {
    const files = await readdir(base);
    return files.filter((f) => f.endsWith(".yaml")).map((f) => f.replace(/\.yaml$/, ""));
  } catch {
    return [];
  }
}

export async function runWorkflow(
  workflowId: string,
  context: SkillExecutionContext,
  inputs: Record<string, unknown> = {},
): Promise<WorkflowRunResult> {
  const workflow = await loadWorkflow(workflowId);
  if (!workflow) {
    return {
      success: false,
      workflow_id: workflowId,
      display_name: workflowId,
      steps_completed: 0,
      artifacts: {},
      step_results: [],
      error: `Workflow not found: ${workflowId}`,
    };
  }

  const executor = await getSkillExecutor();
  const artifacts: Record<string, unknown> = { ...inputs };
  const stepResults: WorkflowRunResult["step_results"] = [];

  for (const step of workflow.steps) {
    const stepInputs: Record<string, unknown> = { ...inputs };
    if (step.consumes?.length) {
      for (const key of step.consumes) {
        if (artifacts[key] != null) stepInputs[key] = artifacts[key];
      }
    }

    const result = await executor.executeSkill(step.skill, stepInputs, context);

    stepResults.push({
      step: step.step,
      name: step.name,
      skill: step.skill,
      success: result.success,
      error: result.error,
      data: result.data,
    });

    if (!result.success) {
      if (step.optional) continue;
      return {
        success: false,
        workflow_id: workflow.id,
        display_name: workflow.display_name,
        steps_completed: stepResults.filter((s) => s.success).length,
        artifacts,
        step_results: stepResults,
        error: `Step ${step.step} (${step.skill}) failed: ${result.error}`,
        guidance: workflow.when_not_to_run,
      };
    }

    if (step.produces?.length && result.data != null) {
      for (const key of step.produces) {
        artifacts[key] = result.data;
      }
    }
  }

  return {
    success: true,
    workflow_id: workflow.id,
    display_name: workflow.display_name,
    steps_completed: stepResults.length,
    artifacts,
    step_results: stepResults,
    guidance: [
      workflow.when_to_run ? `When to run: ${workflow.when_to_run}` : "",
      workflow.when_not_to_run ? `Caution: ${workflow.when_not_to_run}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function buildWorkflowCatalogForPrompt(): string {
  return [
    "- market-regime-daily — breadth + uptrend + exposure posture",
    "- swing-opportunity-daily — swing trade opportunity scan",
    "- multi-asset-opportunity-daily — cross-asset opportunity ranking",
    "- core-portfolio-weekly — weekly portfolio review",
    "- monthly-performance-review — performance attribution",
    "- trade-memory-loop — journal trades into trader-memory-core",
  ].join("\n");
}
