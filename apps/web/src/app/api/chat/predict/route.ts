import { z } from "zod";
import { generateVertexTextCompletion } from "@/lib/gemini/vertex-text-completion";
import { isGeminiRuntimeConfigured } from "@/lib/gemini/vertex-client";
import {
  hasInteractiveQuestionMarkup,
  parseInteractiveQuestion,
  stripInteractiveQuestionMarkup,
} from "@/lib/chat/interactive-question-helper";
import { buildHeuristicFollowUps } from "@/lib/chat/follow-up-heuristics";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .default([]),
  screenContext: z.string().nullable().optional(),
  tradingMode: z.enum(["demo", "live"]).optional().default("demo"),
  activeSymbol: z.string().optional(),
  openPositionSymbols: z.array(z.string()).optional(),
  walletAvailable: z.number().optional(),
});

function formatConversationForPredictor(
  messages: { role: "user" | "assistant"; content: string }[],
): string {
  const recent = messages.slice(-8);
  let formatted = "";
  for (const msg of recent) {
    const cleaned = stripInteractiveQuestionMarkup(msg.content)
      .replace(/```[\s\S]*?```/g, "[UI block]")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (cleaned) {
      formatted += `${msg.role.toUpperCase()}: ${cleaned.slice(0, 2000)}\n\n`;
    }
  }
  return formatted.trim();
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed: z.infer<typeof requestSchema>;
  try {
    parsed = requestSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { messages, screenContext, tradingMode, activeSymbol, openPositionSymbols, walletAvailable } =
    parsed;

  if (messages.length === 0) {
    return Response.json({ error: "Messages are required" }, { status: 400 });
  }

  const lastMsg = messages[messages.length - 1];
  const lastText = lastMsg?.content ?? "";
  if (hasInteractiveQuestionMarkup(lastText)) {
    const inline = parseInteractiveQuestion(lastText);
    if (inline) {
      return Response.json({ question: inline, source: "inline" });
    }
  }

  const turns = messages.map((m) => ({ role: m.role, content: m.content }));

  if (!isGeminiRuntimeConfigured()) {
    return Response.json({
      question: buildHeuristicFollowUps({
        turns,
        activeSymbol,
        openPositionSymbols,
        walletAvailable,
        tradingMode,
      }),
      source: "heuristic",
    });
  }

  const formattedConversation = formatConversationForPredictor(messages);
  const userPrompt = `Active screen context: ${screenContext ?? "Command tab — wealth engine chat"}\n\nConversation:\n${formattedConversation}`;

  const systemInstruction = `You are the Terabits Follow-Up Predictor — a specialized background agent for the Command tab wealth engine.
Analyze the recent conversation and predict what the user is most likely to ask or do next. Output ONLY a valid <interactive-question> block — no preamble, markdown fences, or other text.

Structure:
<interactive-question id="[unique_id]" type="single-select">
  <title>[Short question predicting their next step, e.g. "Dig deeper on BTCUSD?" or "Ready to act on this setup?"]</title>
  <description>[One sentence on what these options will do]</description>
  <option value="[full prompt sent to assistant when tapped]">[Button label ≤ 48 chars]</option>
  ... (2 to 4 options)
</interactive-question>

Guidelines:
- Each option "value" must be a complete, actionable user prompt (not a label fragment).
- Ground suggestions in the last discussed asset(s), tools used, and trading context (${tradingMode} mode).
- If they viewed a chart or price, offer: extend timeframe, intel catalysts, trade plan with stops, or subagent deep dive.
- If they analyzed an asset, offer: compare peers, show market overview, draft trade ticket, or search intel.
- If they discussed a trade, offer: set TP/SL, size the position, run risk review, or show confirmation widget path.
- If they have open positions mentioned, offer: review P&L, adjust exposure, or hedge correlated risk.
- Avoid generic filler like "Tell me more" — every chip must be specific and useful.
- Never repeat the exact question the user just asked.

Remember: output ONLY the <interactive-question> tag.`;

  try {
    const rawResult = await generateVertexTextCompletion({
      userPrompt,
      systemInstruction,
      temperature: 0.15,
      maxTokens: 800,
    });

    const parsedQuestion = parseInteractiveQuestion(rawResult.trim());
    if (parsedQuestion) {
      return Response.json({ question: parsedQuestion, source: "predictor" });
    }

    return Response.json({
      question: buildHeuristicFollowUps({
        turns,
        activeSymbol,
        openPositionSymbols,
        walletAvailable,
        tradingMode,
      }),
      source: "heuristic-fallback",
    });
  } catch (error) {
    console.error("[POST /api/chat/predict] Predictor failed:", error);
    return Response.json({
      question: buildHeuristicFollowUps({
        turns,
        activeSymbol,
        openPositionSymbols,
        walletAvailable,
        tradingMode,
      }),
      source: "heuristic-error",
    });
  }
}
