import {
  getAgentGeminiModelId,
  getVertexGeminiClient,
  geminiIncludeThoughts,
} from "@/lib/gemini/vertex-client";
import { extractToolGenui, extractToolQuantUi, extractToolCanvas } from "@/lib/chat/stream-types";
import { isToolResultOk, runToolByName, type RunToolOptions, type ToolRunContext } from "@/lib/chat/run-tool-by-name";

/** Minimum visible report length after tool calls before accepting completion. */
const MIN_SUBSTANTIVE_REPORT = 600;

export type AgentLoopEvent =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "user_update"; message: string }
  | { type: "status"; label: string; detail?: string }
  | { type: "genui"; payload: unknown; source?: string }
  | { type: "quant_ui"; markup: string; source?: string }
  | { type: "canvas"; html: string; title?: string; source?: string }
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
  pendingCanvas: string | null;
};

type StreamConsumeResult = {
  parts: Array<Record<string, unknown>>;
  reportTextDelta: string;
  bufferedVisibleText: string;
  finishReason?: string;
};

function mergeChunkPart(accumulatedParts: Array<Record<string, any>>, chunkPart: Record<string, any>) {
  if (!chunkPart) return;

  const lastPart = accumulatedParts[accumulatedParts.length - 1];
  let merged = false;

  if (lastPart) {
    const isChunkThought = Boolean(chunkPart.thought);
    const isLastThought = Boolean(lastPart.thought);

    const isChunkText = typeof chunkPart.text === "string";
    const isLastText = typeof lastPart.text === "string";

    const isChunkFC = Boolean(chunkPart.functionCall);
    const isLastFC = Boolean(lastPart.functionCall);

    if (isChunkText && isLastText && isChunkThought === isLastThought && !isChunkFC && !isLastFC) {
      // Merge text/thought parts
      lastPart.text = (lastPart.text ?? "") + (chunkPart.text ?? "");
      merged = true;
    } else if (isChunkFC && isLastFC) {
      // Merge functionCall parts
      if (!lastPart.functionCall) {
        lastPart.functionCall = {};
      }
      const existingFC = lastPart.functionCall;
      const chunkFC = chunkPart.functionCall;

      if (chunkFC.name) {
        existingFC.name = chunkFC.name;
      }

      if (chunkFC.args !== undefined) {
        if (typeof chunkFC.args === "string") {
          existingFC.args = (existingFC.args ?? "") + chunkFC.args;
        } else if (typeof chunkFC.args === "object" && chunkFC.args !== null) {
          if (typeof existingFC.args === "object" && existingFC.args !== null) {
            existingFC.args = { ...existingFC.args, ...chunkFC.args };
          } else {
            existingFC.args = JSON.parse(JSON.stringify(chunkFC.args));
          }
        }
      }
      merged = true;
    }
  }

  if (!merged) {
    // If not merged, push a deep copy of chunkPart as a new part
    accumulatedParts.push(JSON.parse(JSON.stringify(chunkPart)));
  }
}

/** Consume a Gemini stream — accumulate parts sequentially across chunks, emit reasoning/text deltas as-is. */
async function consumeModelStream(
  responseStream: AsyncIterable<{
    candidates?: Array<{
      content?: { parts?: unknown[] };
      finishReason?: string;
    }>;
  }>,
  onEvent: (event: AgentLoopEvent) => void,
  options: { emitVisibleText: boolean },
): Promise<StreamConsumeResult> {
  const accumulatedParts: Array<Record<string, unknown>> = [];
  let reportTextDelta = "";
  let bufferedVisibleText = "";
  let finishReason: string | undefined = undefined;

  for await (const chunk of responseStream) {
    const candidate = chunk.candidates?.[0];
    const chunkParts = candidate?.content?.parts;
    if (candidate?.finishReason) {
      finishReason = candidate.finishReason;
    }
    if (!chunkParts?.length) continue;

    chunkParts.forEach((part) => {
      const p = part as Record<string, any>;
      mergeChunkPart(accumulatedParts, p);

      if (p.thought && typeof p.text === "string" && p.text) {
        onEvent({ type: "reasoning", text: p.text });
      } else if (typeof p.text === "string" && p.text && !p.functionCall) {
        bufferedVisibleText += p.text;
        if (options.emitVisibleText) {
          onEvent({ type: "text", text: p.text });
          reportTextDelta += p.text;
        }
      }
    });
  }

  return { parts: accumulatedParts, reportTextDelta, bufferedVisibleText, finishReason };
}

function extractFunctionCalls(parts: Array<Record<string, unknown>>) {
  return parts.filter((p) => (p as { functionCall?: unknown }).functionCall);
}

async function runRecoveryTextPass(params: {
  contents: Array<Record<string, unknown>>;
  systemInstruction: string;
  onEvent: (event: AgentLoopEvent) => void;
}): Promise<string> {
  const ai = getVertexGeminiClient();
  const model = getAgentGeminiModelId();

  const recoveryContents = [
    ...params.contents,
    {
      role: "user",
      parts: [
        {
          text: `CRITICAL — WRITE YOUR COMPLETE RESPONSE NOW:

You have finished gathering data from your tools. Now write a comprehensive markdown report including:

1. **Summary** — What you analyzed and key findings
2. **Detailed Analysis** — Present ALL data points with specific numbers, levels, and insights
3. **Recommendations** — Clear, actionable next steps

Requirements:
- Use proper markdown formatting with headers, bullet points, bold text
- Include ALL relevant data from your tool calls
- Write at least 3-4 substantial paragraphs
- Be thorough and complete — truncated responses are unacceptable

Do NOT call any more tools. Write your full response immediately.`,
        },
      ],
    },
  ];

  const stream = await ai.models.generateContentStream({
    model,
    contents: recoveryContents,
    config: {
      systemInstruction: params.systemInstruction,
      temperature: 0.3,
      maxOutputTokens: 16384,
      tools: [],
    },
  });

  const { reportTextDelta } = await consumeModelStream(stream, params.onEvent, {
    emitVisibleText: true,
  });
  return reportTextDelta.trim();
}

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
    maxLoops = 15,
    onEvent,
  } = params;

  const ai = getVertexGeminiClient();
  const model = getAgentGeminiModelId();

  const toolConfig = {
    systemInstruction,
    temperature: 0.3,
    maxOutputTokens: 16384,
    thinkingConfig: {
      thinkingBudget: 4096,
      includeThoughts: geminiIncludeThoughts(),
    },
    tools: [{ functionDeclarations }],
  };

  let loopCount = 0;
  let pendingGenui: unknown = null;
  let pendingQuantUi: string | null = null;
  let pendingCanvas: string | null = null;
  let reportText = "";
  let hadToolCalls = false;
  let consecutiveEmptyTurns = 0;
  let loopBreakReason = "max_loops";

  while (loopCount < maxLoops) {
    loopCount++;

    const responseStream = await ai.models.generateContentStream({
      model,
      contents,
      config: toolConfig,
    });

    const { parts, bufferedVisibleText, finishReason } = await consumeModelStream(
      responseStream,
      onEvent,
      { emitVisibleText: false },
    );

    const functionCalls = extractFunctionCalls(parts);

    if (functionCalls.length === 0) {
      if (bufferedVisibleText) {
        // Detect and extract canvas fences before emitting text
        let textToEmit = bufferedVisibleText;
        const canvasFenceRegex = /```canvas\s*\n?([\s\S]*?)```/gi;
        let canvasMatch: RegExpExecArray | null;
        
        while ((canvasMatch = canvasFenceRegex.exec(bufferedVisibleText)) !== null) {
          const canvasHtml = canvasMatch[1].trim();
          if (canvasHtml) {
            pendingCanvas = canvasHtml;
            onEvent({ type: "canvas", html: canvasHtml });
            // Strip the canvas fence from the text
            textToEmit = textToEmit.replace(canvasMatch[0], "");
          }
        }
        
        textToEmit = textToEmit.trim();
        if (textToEmit) {
          onEvent({ type: "text", text: textToEmit });
          reportText += textToEmit;
        }
        consecutiveEmptyTurns = 0;

        const trimmed = reportText.trim();
        const isTruncated = finishReason === "MAX_TOKENS";

        const endsWithCompletePunctuation =
          /[.!?]['"*)_]*$/.test(trimmed) ||
          trimmed.endsWith("```") ||
          trimmed.endsWith("}") ||
          trimmed.endsWith("]");

        const seemsComplete =
          isTruncated ? false :
          (finishReason === "STOP" ? true : endsWithCompletePunctuation);

        // Canvas counts as substantive output
        const hasCanvas = pendingCanvas !== null;
        const isTooShortAfterTools = hadToolCalls && !hasCanvas && trimmed.length < MIN_SUBSTANTIVE_REPORT;

        if (seemsComplete && !isTooShortAfterTools) {
          loopBreakReason = "seems_complete";
          break;
        }

        // If no tools ran and the response is extremely short (less than a complete sentence/greeting buffer), ask to continue
        if (!hadToolCalls && trimmed.length < 120) {
          contents.push({
            role: "model",
            parts: [{ text: bufferedVisibleText }],
          });
          contents.push({
            role: "user",
            parts: [{ text: "Please provide a more complete answer." }],
          });
          loopBreakReason = "continue_short_text";
          continue;
        }

        // Otherwise, ask the model to continue its output precisely
        let continuePrompt = "";
        if (isTruncated) {
          continuePrompt = "Your previous response was cut off due to length limits. Please continue your response precisely where you left off, without repeating yourself or restarting.";
        } else if (isTooShortAfterTools) {
          continuePrompt = trimmed.length < 80
            ? "Write your complete, detailed analysis and recommendations now. Include all findings from your tool calls."
            : "Continue and complete your analysis. Provide the full detailed response with all data points, levels, and recommendations.";
        } else {
          continuePrompt = "Please continue your response and complete your explanation or analysis fully.";
        }

        contents.push({
          role: "model",
          parts: [{ text: bufferedVisibleText }],
        });
        contents.push({
          role: "user",
          parts: [{ text: continuePrompt }],
        });
        loopBreakReason = isTruncated
          ? "continue_truncated"
          : isTooShortAfterTools
            ? "continue_after_tools"
            : "continue_incomplete";
        continue;
      } else {
        consecutiveEmptyTurns++;
      }

      // Only break if we have final text OR hit too many empty turns
      if (reportText.trim() || consecutiveEmptyTurns >= 2) {
        loopBreakReason = reportText.trim() ? "has_report_text" : "consecutive_empty_turns";
        break;
      }

      // No text yet — try one more turn to elicit a response
      contents.push({
        role: "user",
        parts: [{ text: "Write your complete, detailed analysis and recommendations now. Include all findings from your tool calls." }],
      });
      continue;
    }

    hadToolCalls = true;
    consecutiveEmptyTurns = 0;

    // Planning text in the same turn as tool calls → user update, not final reply.
    const planning = bufferedVisibleText.trim();
    if (planning) {
      onEvent({ type: "user_update", message: planning });
    }

    contents.push({ role: "model", parts });

    const toolResponseParts: Array<Record<string, unknown>> = [];

    for (const callPart of functionCalls) {
      const call = (callPart as { functionCall: { name: string; args?: Record<string, unknown> } })
        .functionCall;
      const name = call.name;
      const args = (call.args ?? {}) as Record<string, unknown>;

      if (name === "inform_user") {
        const toolResult = await runToolByName(name, args, toolCtx, toolOptions);
        toolResponseParts.push({
          functionResponse: { name, response: toolResult },
        });
        continue;
      }

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
      const toolCanvas = ok ? extractToolCanvas(toolResult) : null;
      if (toolQuantUi) {
        onEvent({ type: "quant_ui", markup: toolQuantUi, source: name });
      } else if (toolGenui) {
        onEvent({ type: "genui", payload: toolGenui, source: name });
      } else if (toolCanvas) {
        onEvent({ type: "canvas", html: toolCanvas.html, title: toolCanvas.title, source: name });
      }

      // For failed GenUI/chart tools, provide detailed error feedback to help the model retry
      let responseForModel: unknown = toolResult;
      if (!ok && (name.includes("chart") || name.includes("overview") || name.includes("market"))) {
        const errorMsg = (toolResult as { error?: string })?.error ?? "Unknown error";
        const baseResult = typeof toolResult === "object" && toolResult !== null ? toolResult : {};
        responseForModel = {
          ...(baseResult as Record<string, unknown>),
          error: errorMsg,
          guidance: `The ${name} tool failed. Error: ${errorMsg}. Please try again with corrected parameters or use an alternative approach.`,
        };
      }

      toolResponseParts.push({
        functionResponse: {
          name,
          response: responseForModel,
        },
      });
    }

    contents.push({
      role: "user",
      parts: toolResponseParts,
    });
  }

  // Force final response if tools ran but output is missing or still too short (canvas counts as substantive)
  const reportLen = reportText.trim().length;
  const hasCanvas = pendingCanvas !== null;
  const needsRecovery = hadToolCalls && !hasCanvas && reportLen < MIN_SUBSTANTIVE_REPORT;

  if (needsRecovery) {
    onEvent({ type: "status", label: "Finalizing response" });

    if (reportLen > 0) {
      contents.push({
        role: "user",
        parts: [
          {
            text: "Your previous response was incomplete. Write the FULL comprehensive analysis now with all sections, data points, and recommendations.",
          },
        ],
      });
    }

    // Try up to 2 recovery attempts
    let recovered = "";
    for (let attempt = 0; attempt < 2 && recovered.length < MIN_SUBSTANTIVE_REPORT; attempt++) {
      if (attempt > 0) {
        onEvent({ type: "status", label: "Retry synthesis", detail: `Attempt ${attempt + 1}` });
      }

      recovered = await runRecoveryTextPass({
        contents,
        systemInstruction,
        onEvent,
      });
    }

    if (recovered.length >= MIN_SUBSTANTIVE_REPORT || recovered.length > reportLen) {
      reportText = recovered;
    } else if (!reportText.trim()) {
      reportText =
        "Analysis complete. Tools executed successfully. Please rephrase your question for more detailed results.";
      onEvent({ type: "text", text: reportText });
    }
  } else if (!reportText.trim() && loopBreakReason === "consecutive_empty_turns") {
    const fallback =
      "I couldn't generate a response for that request. Please try rephrasing or asking again.";
    reportText = fallback;
    onEvent({ type: "text", text: fallback });
  }

  return { reportText: reportText.trim(), pendingGenui, pendingQuantUi, pendingCanvas };
}
