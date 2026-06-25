import {
  applySubagentReasoningToSteps,
  applySubagentToolStartToSteps,
  finalizeActivitySteps,
} from "@/lib/chat/activity-timeline";
import { deriveLiveTraceFromSteps, LIVE_TRACE_PLANNING } from "@/lib/chat/live-trace";
import type { ChatStreamEvent, ChatToolPod } from "@/lib/chat/stream-types";
import type { SubAgentState } from "@/lib/chat/subagent-types";

function bumpTraceTick(agent: SubAgentState): SubAgentState {
  return { ...agent, traceTick: Date.now() };
}

function refreshLiveTrace(agent: SubAgentState): SubAgentState {
  const steps = agent.activitySteps ?? [];
  return bumpTraceTick({
    ...agent,
    liveTrace: deriveLiveTraceFromSteps(steps, agent.assignmentLabel || LIVE_TRACE_PLANNING),
  });
}

function applySubagentToolEndToSteps(
  steps: SubAgentState["activitySteps"],
  pod: ChatToolPod,
): SubAgentState["activitySteps"] {
  if (!steps) return steps;
  return steps.map((s) =>
    s.type === "tool" && s.toolUseId === pod.toolUseId ? { type: "tool", ...pod } : s,
  );
}

export function applySubagentStreamEvent(
  agents: SubAgentState[],
  event: ChatStreamEvent,
): SubAgentState[] | null {
  if (event.type === "subagent_start") {
    if (agents.some((a) => a.id === event.id)) return null;
    const assignmentLabel = event.assignmentLabel?.trim() || LIVE_TRACE_PLANNING;
    return [
      ...agents,
      bumpTraceTick({
        id: event.id,
        prompt: event.prompt,
        assignmentLabel,
        status: "running",
        color: event.color,
        reasoning: "",
        toolPods: [],
        activitySteps: [],
        liveTrace: assignmentLabel,
        report: "",
      }),
    ];
  }

  const agentId =
    event.type === "subagent_reasoning" ||
    event.type === "subagent_update" ||
    event.type === "subagent_text" ||
    event.type === "subagent_tool_start" ||
    event.type === "subagent_tool_end" ||
    event.type === "subagent_end"
      ? event.id
      : null;
  if (!agentId) return null;

  const idx = agents.findIndex((a) => a.id === agentId);
  if (idx < 0) return null;

  const next = [...agents];
  let agent = { ...next[idx] };

  if (event.type === "subagent_reasoning") {
    agent.reasoning = `${agent.reasoning}${event.text}`;
    agent.activitySteps = applySubagentReasoningToSteps(agent.activitySteps ?? [], event.text);
    agent = refreshLiveTrace(agent);
    next[idx] = agent;
    return next;
  }

  if (event.type === "subagent_update") {
    const msg = event.message.trim();
    if (msg) {
      agent.liveTrace = msg;
      agent = bumpTraceTick(agent);
    }
    next[idx] = agent;
    return next;
  }

  if (event.type === "subagent_text") {
    agent.report = `${agent.report ?? ""}${event.text}`;
    next[idx] = agent;
    return next;
  }

  if (event.type === "subagent_tool_start") {
    const pods = [...agent.toolPods];
    const existing = pods.findIndex((p) => p.toolUseId === event.toolUseId);
    const pod: ChatToolPod = {
      toolUseId: event.toolUseId,
      name: event.name,
      status: "running",
      args: event.args,
    };
    if (existing >= 0) pods[existing] = { ...pods[existing], ...pod };
    else pods.push(pod);
    agent.toolPods = pods;
    agent.activitySteps = applySubagentToolStartToSteps(agent.activitySteps ?? [], pod);
    agent = refreshLiveTrace(agent);
    next[idx] = agent;
    return next;
  }

  if (event.type === "subagent_tool_end") {
    const pods = [...agent.toolPods];
    const existing = pods.findIndex((p) => p.toolUseId === event.toolUseId);
    const done: ChatToolPod = {
      toolUseId: event.toolUseId,
      name: event.name,
      status: "done",
      ok: event.ok,
      output: event.output,
      error: event.error,
      durationMs: event.durationMs,
    };
    if (existing >= 0) pods[existing] = { ...pods[existing], ...done };
    else pods.push(done);
    agent.toolPods = pods;
    agent.activitySteps = applySubagentToolEndToSteps(agent.activitySteps, done);
    agent = refreshLiveTrace(agent);
    next[idx] = agent;
    return next;
  }

  if (event.type === "subagent_end") {
    agent.status = event.status;
    if (event.report?.trim()) agent.report = event.report;
    agent.error = event.error;
    agent.durationMs = event.durationMs;
    if (agent.activitySteps) {
      agent.activitySteps = finalizeActivitySteps(agent.activitySteps);
    }
    next[idx] = agent;
    return next;
  }

  return null;
}
