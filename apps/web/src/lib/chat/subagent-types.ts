import type { ActivityStep } from "@/lib/chat/activity-timeline";
import type { ChatToolPod } from "@/lib/chat/stream-types";
import { LIVE_TRACE_PLANNING, shortenLivePhrase } from "@/lib/chat/live-trace";

export const SUBAGENT_COLOR_PALETTE = [
  "cyan",
  "blue",
  "violet",
  "amber",
  "rose",
  "emerald",
] as const;

export type SubAgentColorScheme = (typeof SUBAGENT_COLOR_PALETTE)[number];

export type SubAgentStatus = "running" | "done" | "failed";

export type SubAgentState = {
  id: string;
  /** Full orchestrator delegation — shown in detail pane only, not the widget. */
  prompt: string;
  /** Short NL assignment trace for the widget (from orchestrator). */
  assignmentLabel: string;
  status: SubAgentStatus;
  color: SubAgentColorScheme;
  reasoning: string;
  toolPods: ChatToolPod[];
  /** Natural-language status shown while running (derived from model reasoning). */
  liveTrace?: string;
  /** Ordered reasoning + tool steps for live UI. */
  activitySteps?: ActivityStep[];
  report?: string;
  error?: string;
  durationMs?: number;
  /** Bumps on each live trace update — newest stacks on top. */
  traceTick?: number;
};

/** @deprecated Legacy persisted shape — normalized on load. */
export type LegacySubAgentState = SubAgentState & {
  role?: string;
  assetSymbol?: string;
  instruction?: string;
};

export function subAgentColorAt(index: number): SubAgentColorScheme {
  return SUBAGENT_COLOR_PALETTE[index % SUBAGENT_COLOR_PALETTE.length];
}

export function sortAgentsForOrbStack(agents: SubAgentState[]): SubAgentState[] {
  return [...agents].sort((a, b) => (a.traceTick ?? 0) - (b.traceTick ?? 0));
}

export function leadSubAgent(agents: SubAgentState[]): SubAgentState {
  return agents.reduce((best, agent) =>
    (agent.traceTick ?? 0) >= (best.traceTick ?? 0) ? agent : best,
  );
}

export function subAgentPromptLabel(prompt: string, max = 56): string {
  const line = prompt.trim().split(/\n/)[0]?.trim() || "Sub-agent";
  if (line.length <= max) return line;
  return `${line.slice(0, max - 1)}…`;
}

/** Normalize legacy persisted sub-agents (role/asset/instruction) into prompt-only shape. */
export function normalizeSubAgentState(raw: unknown): SubAgentState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as LegacySubAgentState & { prompt?: string };
  if (typeof o.id !== "string") return null;

  let prompt = typeof o.prompt === "string" ? o.prompt.trim() : "";
  if (!prompt) {
    const parts: string[] = [];
    if (o.instruction?.trim()) parts.push(o.instruction.trim());
    else {
      if (o.role?.trim()) parts.push(o.role.trim());
      if (o.assetSymbol?.trim()) parts.push(`Analyze ${o.assetSymbol.trim()}.`);
    }
    prompt = parts.join(" ").trim() || "Sub-agent task";
  }

  return {
    id: o.id,
    prompt,
    assignmentLabel:
      typeof o.assignmentLabel === "string" && o.assignmentLabel.trim()
        ? o.assignmentLabel.trim()
        : subAgentPromptLabel(prompt, 48),
    status: o.status === "running" || o.status === "failed" ? o.status : "done",
    color: (o.color as SubAgentColorScheme) ?? "cyan",
    reasoning: typeof o.reasoning === "string" ? o.reasoning : "",
    toolPods: Array.isArray(o.toolPods) ? (o.toolPods as ChatToolPod[]) : [],
    liveTrace: typeof o.liveTrace === "string" ? o.liveTrace : undefined,
    activitySteps: Array.isArray(o.activitySteps) ? (o.activitySteps as ActivityStep[]) : undefined,
    report: typeof o.report === "string" ? o.report : undefined,
    error: typeof o.error === "string" ? o.error : undefined,
    durationMs: typeof o.durationMs === "number" ? o.durationMs : undefined,
    traceTick: typeof o.traceTick === "number" ? o.traceTick : undefined,
  };
}

export function normalizeSubAgentList(raw: unknown): SubAgentState[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map(normalizeSubAgentState).filter((a): a is SubAgentState => a != null);
}

export function resolveSubagentLabelFromArgs(sub: Record<string, unknown>): string {
  const label = typeof sub.label === "string" ? sub.label.trim() : "";
  if (label) return label.length > 56 ? `${label.slice(0, 55)}…` : label;
  const prompt = resolveSubagentPromptFromArgs(sub);
  const shortened = shortenLivePhrase(prompt);
  if (shortened) return shortened;
  return LIVE_TRACE_PLANNING;
}

export function resolveSubagentPromptFromArgs(sub: Record<string, unknown>): string {
  const direct = typeof sub.prompt === "string" ? sub.prompt.trim() : "";
  if (direct) return direct;

  const instruction = typeof sub.instruction === "string" ? sub.instruction.trim() : "";
  const role = typeof sub.role === "string" ? sub.role.trim() : "";
  const asset = typeof sub.asset_symbol === "string" ? sub.asset_symbol.trim() : "";

  if (instruction) {
    const prefix: string[] = [];
    if (role) prefix.push(role);
    if (asset) prefix.push(`for ${asset}`);
    return prefix.length > 0 ? `${prefix.join(" ")}: ${instruction}` : instruction;
  }

  return "Use available tools to complete the delegated analysis. Report only verified findings.";
}
