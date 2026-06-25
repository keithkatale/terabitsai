import { runAgentLoop } from "@/lib/chat/agent-loop";
import { SUBAGENT_READ_ONLY_TOOL_NAMES, subagentReadOnlyDeclarations } from "@/lib/chat/tool-declarations";
import type { ToolRunContext } from "@/lib/chat/run-tool-by-name";
import { resolveSubagentLabelFromArgs, resolveSubagentPromptFromArgs, subAgentColorAt } from "@/lib/chat/subagent-types";
import type { ChatStreamEvent } from "@/lib/chat/stream-types";

const MAX_SUBAGENTS = 5;

const SUBAGENT_SYSTEM_PREAMBLE = `You are a Terabits Wealth Engine sub-agent — a specialized parallel instance of the main trading AI assistant.

You have the same capabilities as the orchestrator agent, including:
- Pulling live quotes and historical OHLCV via get_asset_market_data
- Technical analysis via analyze_chart (TradingView data + AI vision)
- Rendering charts via render_asset_chart, render_comparative_chart
- Market overviews via get_market_overview
- Searching verified market intelligence via search_market_intel
- Querying trading knowledge via query_trading_knowledge
- Getting catalyst briefs and fundamentals
- Web scraping via web_scrape (fetch content from any URL)
- HTTP requests via http_request (call external APIs)

The only differences from the orchestrator:
- You CANNOT spawn nested sub-agents (no spawn_subagents tool)
- You CANNOT execute trades or modify goals (read-only analysis)

CRITICAL — ACCURACY:
- Never invent prices, levels, indicator readings, patterns, headlines, or conclusions.
- Only state facts returned by your tools. If data is missing, say so explicitly.
- Hedge appropriately when evidence is thin.

RESPONSE FORMAT:
- Provide a COMPLETE, DETAILED markdown report addressing your delegated task.
- Use structured formatting: headers, bullet points, tables where appropriate.
- Include specific numbers, levels, and data from your tool calls.
- Your report should be comprehensive enough for the orchestrator to synthesize.

TOOL FAILURE HANDLING:
- If a tool fails, read the error and retry with corrected parameters.
- Try alternative tools before giving up.
- If data is unavailable, explicitly state what's missing but still provide analysis on available data.

LIVE STATUS:
- Call inform_user() for brief progress updates (what you are doing or about to do).

CRITICAL — ALWAYS COMPLETE YOUR RESPONSE:
- You MUST produce a full markdown report in your visible response.
- NEVER stop after thinking or tool calls without writing your final report.
- Your response should be several paragraphs with structured analysis — not just a few sentences.
- If you gathered data, present ALL of it with proper formatting.
- Incomplete or truncated responses are unacceptable.`;

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
      toolCtx: {
        ...ctx,
        subagentId: id,
        sendEvent: (event) => {
          if (event.type === "user_update") {
            sendEvent({ type: "subagent_update", id, message: event.message });
          }
        },
      },
      toolOptions: { allowedTools: SUBAGENT_READ_ONLY_TOOL_NAMES },
      maxLoops: 15,
      onEvent: (event) => {
        if (event.type === "user_update") {
          sendEvent({ type: "subagent_update", id, message: event.message });
          return;
        }
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
