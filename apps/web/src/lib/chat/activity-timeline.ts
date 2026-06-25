import type { ChatToolPod } from "@/lib/chat/stream-types";

export type ReasoningActivityStep = {
  type: "reasoning";
  id: string;
  text: string;
  status: "streaming" | "done";
};

export type ToolActivityStep = ChatToolPod & { type: "tool" };

export type UpdateActivityStep = {
  type: "update";
  id: string;
  text: string;
};

export type ActivityStep = ReasoningActivityStep | ToolActivityStep | UpdateActivityStep;

export type ActivityPartRef =
  | { type: "reasoning"; text?: string }
  | { type: "tool_ref"; toolUseId: string }
  | { type: "user_update"; text?: string };

export function buildActivityTimeline(
  parts: ActivityPartRef[],
  toolPods: ChatToolPod[] = [],
  isStreaming = false,
  includeUpdates = false,
): ActivityStep[] {
  const podMap = new Map(toolPods.map((p) => [p.toolUseId, p]));
  const steps: ActivityStep[] = [];
  let reasoningIdx = 0;
  let updateIdx = 0;

  for (const part of parts) {
    if (part.type === "reasoning" && part.text != null) {
      steps.push({
        type: "reasoning",
        id: `reasoning-${reasoningIdx++}`,
        text: part.text,
        status: "done",
      });
    } else if (part.type === "user_update" && part.text != null) {
      // Only include updates if explicitly requested (for legacy code)
      if (includeUpdates) {
        steps.push({
          type: "update",
          id: `update-${updateIdx++}`,
          text: part.text,
        });
      }
    } else if (part.type === "tool_ref") {
      const pod = podMap.get(part.toolUseId);
      if (pod) steps.push({ type: "tool", ...pod });
    }
  }

  if (!isStreaming || steps.length === 0) {
    return steps;
  }

  return annotateStreamingSteps(steps);
}

export function annotateStreamingSteps(steps: ActivityStep[]): ActivityStep[] {
  const last = steps[steps.length - 1];
  return steps.map((step, i) => {
    if (step.type === "tool") return step;
    const isLast = i === steps.length - 1;
    if (isLast && last?.type === "reasoning") {
      return { ...step, status: "streaming" as const };
    }
    return { ...step, status: "done" as const };
  });
}

/** Legacy messages without tool_ref parts — reasoning blob then tools. */
export function buildLegacyActivityTimeline(
  reasoning: string,
  toolPods: ChatToolPod[] = [],
  isStreaming = false,
): ActivityStep[] {
  const steps: ActivityStep[] = [];
  const r = reasoning.trim();
  if (r) {
    steps.push({ type: "reasoning", id: "reasoning-0", text: r, status: "done" });
  }
  for (const pod of toolPods) {
    steps.push({ type: "tool", ...pod });
  }
  if (isStreaming && steps.length > 0) {
    return annotateStreamingSteps(steps);
  }
  return steps;
}

export function getActiveActivityStep(steps: ActivityStep[]): ActivityStep | null {
  const streamingReasoning = [...steps].reverse().find(
    (s): s is ReasoningActivityStep => s.type === "reasoning" && s.status === "streaming",
  );
  if (streamingReasoning) return streamingReasoning;

  const runningTool = [...steps].reverse().find(
    (s): s is ToolActivityStep => s.type === "tool" && s.status === "running",
  );
  if (runningTool) return runningTool;

  return null;
}

export function finalizeActivitySteps(steps: ActivityStep[]): ActivityStep[] {
  return steps.map((s) =>
    s.type === "reasoning" ? { ...s, status: "done" as const } : s,
  );
}

let reasoningCounter = 0;

export function applyReasoningToParts(
  parts: ActivityPartRef[],
  text: string,
): ActivityPartRef[] {
  const next = [...parts];
  const last = next[next.length - 1];
  if (last?.type === "reasoning") {
    next[next.length - 1] = { type: "reasoning", text: `${last.text ?? ""}${text}` };
  } else {
    next.push({ type: "reasoning", text });
  }
  return next;
}

export function applyToolStartToParts(
  parts: ActivityPartRef[],
  toolUseId: string,
): ActivityPartRef[] {
  const next = [...parts];
  const last = next[next.length - 1];
  if (last?.type === "tool_ref" && last.toolUseId === toolUseId) return next;
  next.push({ type: "tool_ref", toolUseId });
  return next;
}

export function applyUserUpdateToParts(
  parts: ActivityPartRef[],
  message: string,
): ActivityPartRef[] {
  const text = message.trim();
  if (!text) return parts;
  return [...parts, { type: "user_update", text }];
}

export function applySubagentReasoningToSteps(
  steps: ActivityStep[],
  text: string,
): ActivityStep[] {
  const next = [...steps];
  const last = next[next.length - 1];
  if (last?.type === "reasoning" && last.status === "streaming") {
    next[next.length - 1] = { ...last, text: `${last.text}${text}` };
    return next;
  }
  if (last?.type === "reasoning") {
    next[next.length - 1] = { ...last, status: "done" };
  }
  reasoningCounter += 1;
  next.push({
    type: "reasoning",
    id: `sub-r-${reasoningCounter}`,
    text,
    status: "streaming",
  });
  return next;
}

export function applySubagentToolStartToSteps(
  steps: ActivityStep[],
  pod: ChatToolPod,
): ActivityStep[] {
  let next = [...steps];
  const last = next[next.length - 1];
  if (last?.type === "reasoning" && last.status === "streaming") {
    next[next.length - 1] = { ...last, status: "done" };
  }
  const existing = next.findIndex((s) => s.type === "tool" && s.toolUseId === pod.toolUseId);
  if (existing >= 0) {
    next[existing] = { type: "tool", ...pod };
  } else {
    next.push({ type: "tool", ...pod });
  }
  return next;
}
