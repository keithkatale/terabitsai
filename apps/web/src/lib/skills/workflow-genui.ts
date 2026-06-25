import type { WorkflowRunResult } from "./workflow-runner";

export function buildWorkflowResultGenui(result: WorkflowRunResult) {
  const completed = result.step_results.filter((s) => s.success).length;
  const total = result.step_results.length;
  const failed = result.step_results.filter((s) => !s.success);

  const stepItems = result.step_results.map((s) => ({
    label: s.name,
    value: s.success ? "✓" : "failed",
    accent: s.success ? "emerald" : "rose",
  }));

  const nodes: Record<string, unknown>[] = [
    {
      type: "section",
      title: result.display_name,
      subtitle: result.guidance?.split("\n")[0] ?? `Workflow ${result.workflow_id}`,
      children: [
        {
          type: "grid",
          columns: 2,
          children: [
            {
              type: "metricCard",
              label: "Steps completed",
              value: `${completed}/${total}`,
              accent: failed.length === 0 ? "emerald" : "amber",
            },
            {
              type: "metricCard",
              label: "Status",
              value: result.success ? "Complete" : "Partial",
              accent: result.success ? "cyan" : "rose",
            },
          ],
        },
        { type: "barlist", title: "Pipeline steps", items: stepItems },
      ],
    },
  ];

  if (result.artifacts.exposure_decision) {
    const decision = result.artifacts.exposure_decision;
    const text =
      typeof decision === "string"
        ? decision
        : typeof decision === "object" && decision !== null
          ? JSON.stringify(decision, null, 2).slice(0, 500)
          : String(decision);
    nodes.push({
      type: "callout",
      variant: "info",
      title: "Exposure posture",
      text,
    });
  }

  for (const step of result.step_results.filter((s) => s.success && s.data)) {
    if (step.skill.includes("regime") || step.skill.includes("breadth")) {
      nodes.push({
        type: "callout",
        variant: "success",
        title: step.name,
        text: typeof step.data === "string" ? step.data : JSON.stringify(step.data).slice(0, 300),
      });
      break;
    }
  }

  return { view: nodes };
}
