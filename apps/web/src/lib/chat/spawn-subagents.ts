import { runAgentLoop } from "@/lib/chat/agent-loop";
import { SUBAGENT_READ_ONLY_TOOL_NAMES, subagentReadOnlyDeclarations } from "@/lib/chat/tool-declarations";
import type { ToolRunContext } from "@/lib/chat/run-tool-by-name";
import { resolveSubagentLabelFromArgs, resolveSubagentPromptFromArgs, subAgentColorAt } from "@/lib/chat/subagent-types";
import type { ChatStreamEvent } from "@/lib/chat/stream-types";

const MAX_SUBAGENTS = 5;

const SUBAGENT_SYSTEM_PREAMBLE = `You are a Terabits wealth-engine sub-agent executing a delegated research task.

CRITICAL — NO FALSE POSITIVES:
- Never invent prices, levels, indicator readings, patterns, headlines, catalysts, or conclusions.
- Only state facts returned by your tools. If a tool fails or data is missing, say so explicitly.
- Do not imply certainty you cannot verify. Hedge appropriately when evidence is thin.
- Fabricated analysis is forbidden and harms the user.

You have read-only tools (market data, charts, intel, knowledge). Do NOT trade, modify goals, schedule tasks, or spawn nested sub-agents.
Follow the user prompt precisely. End with a structured markdown report the orchestrator can synthesize.

LIVE STATUS (shown to the user while you work):
- In your thinking, emit ONE short phrase per step (about 3–7 words) — e.g. "Analyzing Bitcoin", "Searching the web", "Digging deeper".
- Never write long sentences. Plain English only — not tool names or JSON.`;

export type SubagentSpec = {
  prompt: string;
  assignmentLabel: string;
};

export async function runSpawnSubagents(
  subagentsList: Array<Record<string, unknown>>,
  ctx: ToolRunContext,
): Promise<{ success: boolean; team_results: Array<Record<string, unknown>> }> {
  const sendEvent = ctx.sendEvent;
  if (!sendEvent) {
    return { success: false, team_results: [] };
  }

  const capped = subagentsList.slice(0, MAX_SUBAGENTS);

  const results = await Promise.all(
    capped.map((sub, index) =>
      runSingleSubagent(
        {
          prompt: resolveSubagentPromptFromArgs(sub),
          assignmentLabel: resolveSubagentLabelFromArgs(sub),
        },
        index,
        ctx,
        sendEvent,
      ),
    ),
  );

  return { success: true, team_results: results };
}

async function runSingleSubagent(
  sub: SubagentSpec,
  index: number,
  ctx: ToolRunContext,
  sendEvent: (event: ChatStreamEvent) => void,
): Promise<Record<string, unknown>> {
  const id = `subagent-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
  const color = subAgentColorAt(index);
  const started = Date.now();
  const prompt = sub.prompt.trim();
  const assignmentLabel = sub.assignmentLabel.trim() || assignmentLabelFromPrompt(prompt);

  sendEvent({
    type: "subagent_start",
    id,
    prompt,
    assignmentLabel,
    color,
  });

  const systemInstruction = `${SUBAGENT_SYSTEM_PREAMBLE}

Delegated task:
${prompt}`;

  const contents: Array<Record<string, unknown>> = [
    {
      role: "user",
      parts: [{ text: prompt }],
    },
  ];

  try {
    const { reportText } = await runAgentLoop({
      contents,
      systemInstruction,
      functionDeclarations: subagentReadOnlyDeclarations,
      toolCtx: { ...ctx, sendEvent: undefined },
      toolOptions: { allowedTools: SUBAGENT_READ_ONLY_TOOL_NAMES },
      maxLoops: 4,
      onEvent: (event) => {
        if (event.type === "reasoning") {
          sendEvent({ type: "subagent_reasoning", id, text: event.text });
        } else if (event.type === "text") {
          sendEvent({ type: "subagent_text", id, text: event.text });
        } else if (event.type === "tool_start") {
          sendEvent({
            type: "subagent_tool_start",
            id,
            toolUseId: event.toolUseId,
            name: event.name,
            args: event.args,
          });
        } else if (event.type === "tool_end") {
          sendEvent({
            type: "subagent_tool_end",
            id,
            toolUseId: event.toolUseId,
            name: event.name,
            ok: event.ok,
            output: event.output,
            error: event.error,
            durationMs: event.durationMs,
          });
        }
      },
    });

    const durationMs = Date.now() - started;
    sendEvent({
      type: "subagent_end",
      id,
      status: "done",
      report: reportText || undefined,
      durationMs,
    });

    return {
      id,
      prompt,
      assignmentLabel,
      status: "success",
      report: reportText,
      durationMs,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - started;

    sendEvent({
      type: "subagent_end",
      id,
      status: "failed",
      error: errMsg,
      durationMs,
    });

    return {
      id,
      prompt,
      assignmentLabel,
      status: "failed",
      error: errMsg,
      durationMs,
    };
  }
}

function assignmentLabelFromPrompt(prompt: string): string {
  const line = prompt.trim().split(/\n/)[0]?.trim() ?? "";
  if (line.length <= 56) return line || "Assigned task";
  return `${line.slice(0, 55)}…`;
}
