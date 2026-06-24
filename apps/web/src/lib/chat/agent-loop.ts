import {
  getAgentGeminiModelId,
  getVertexGeminiClient,
  geminiIncludeThoughts,
} from "@/lib/gemini/vertex-client";
import { extractToolGenui, extractToolQuantUi } from "@/lib/chat/stream-types";
import { isToolResultOk, runToolByName, type RunToolOptions, type ToolRunContext } from "@/lib/chat/run-tool-by-name";

export type AgentLoopEvent =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "status"; label: string; detail?: string }
  | { type: "tool_start"; toolUseId: string; name: string; args?: Record<string, unknown> }
  | {
      type: "tool_end";
      toolUseId: string;
      name: string;
      ok: boolean;
      args?: Record<string, unknown>;
      output?: unknown;
      error?: string;
      durationMs: number;
    };

export type AgentLoopResult = {
  reportText: string;
  pendingGenui: unknown;
  pendingQuantUi: string | null;
};

export async function runAgentLoop(params: {
  contents: Array<Record<string, unknown>>;
  systemInstruction: string;
  functionDeclarations: Array<Record<string, unknown>>;
  toolCtx: ToolRunContext;
  toolOptions?: RunToolOptions;
  maxLoops?: number;
  onEvent: (event: AgentLoopEvent) => void;
}): Promise<AgentLoopResult> {
  const {
    contents,
    systemInstruction,
    functionDeclarations,
    toolCtx,
    toolOptions,
    maxLoops = 5,
    onEvent,
  } = params;

  const ai = getVertexGeminiClient();
  const model = getAgentGeminiModelId();

  const toolConfig = {
    systemInstruction,
    temperature: 0.3,
    maxOutputTokens: 8192,
    thinkingConfig: {
      thinkingBudget: 2048,
      includeThoughts: geminiIncludeThoughts(),
    },
    tools: [{ functionDeclarations }],
  };

  let loopCount = 0;
  let pendingGenui: unknown = null;
  let pendingQuantUi: string | null = null;
  let reportText = "";

  while (loopCount < maxLoops) {
    loopCount++;

    const responseStream = await ai.models.generateContentStream({
      model,
      contents,
      config: toolConfig,
    });

    const parts: Array<Record<string, unknown>> = [];

    for await (const chunk of responseStream) {
      const chunkParts = chunk.candidates?.[0]?.content?.parts || [];
      for (const part of chunkParts) {
        parts.push(part as Record<string, unknown>);
        if ((part as { thought?: boolean }).thought && (part as { text?: string }).text) {
          onEvent({ type: "reasoning", text: (part as { text: string }).text });
        } else if ((part as { text?: string }).text && !(part as { functionCall?: unknown }).functionCall) {
          const text = (part as { text: string }).text;
          reportText += text;
          onEvent({ type: "text", text });
        }
      }
    }

    const functionCalls = parts.filter((p) => (p as { functionCall?: unknown }).functionCall);

    if (functionCalls.length === 0) {
      break;
    }

    contents.push({ role: "model", parts });

    const toolResponseParts: Array<Record<string, unknown>> = [];

    for (const callPart of functionCalls) {
      const call = (callPart as { functionCall: { name: string; args?: Record<string, unknown> } }).functionCall;
      const name = call.name;
      const args = (call.args ?? {}) as Record<string, unknown>;
      const toolUseId = `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const started = Date.now();

      onEvent({ type: "tool_start", toolUseId, name, args });

      const toolResult = await runToolByName(name, args, toolCtx, toolOptions);
      const ok = isToolResultOk(toolResult);

      onEvent({
        type: "tool_end",
        toolUseId,
        name,
        ok,
        args,
        output: toolResult,
        error: ok ? undefined : String((toolResult as { error?: string })?.error ?? "Tool failed"),
        durationMs: Date.now() - started,
      });

      const toolQuantUi = ok ? extractToolQuantUi(toolResult) : null;
      const toolGenui = ok ? extractToolGenui(toolResult) : null;
      if (toolQuantUi) pendingQuantUi = toolQuantUi;
      else if (toolGenui) pendingGenui = toolGenui;

      toolResponseParts.push({
        functionResponse: {
          name,
          response: toolResult,
        },
      });
    }

    contents.push({
      role: "user",
      parts: toolResponseParts,
    });
  }

  return { reportText: reportText.trim(), pendingGenui, pendingQuantUi };
}
