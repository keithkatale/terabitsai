import { NextResponse } from "next/server";
import { generateVertexTextCompletion } from "@/lib/gemini/vertex-text-completion";
import {
  archiveSessionInPlace,
  loadConversationMessages,
} from "@/lib/chat/conversation-persistence";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function messageTextFromParts(
  parts: Array<{ type: string; text?: string }>,
): string {
  return parts
    .filter((p) => p.type !== "session_divider" && p.text?.trim())
    .map((p) => p.text)
    .join("\n");
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: conversationId } = await context.params;

  try {
    const messages = await loadConversationMessages(conversationId, user.id);
    if (!messages) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    let segmentStart = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].parts.some((p) => p.type === "session_divider")) {
        segmentStart = i + 1;
        break;
      }
    }

    const segment = messages.slice(segmentStart).filter((m) => {
      if (m.role === "system") return false;
      return messageTextFromParts(m.parts).trim().length > 0;
    });

    if (segment.length === 0) {
      return NextResponse.json(
        { error: "No messages to summarize in this session" },
        { status: 400 },
      );
    }

    const transcript = segment
      .map((m) => {
        const label =
          m.parts.some((p) => p.type === "monitor_directive")
            ? "Wealth Monitor"
            : m.role === "user"
              ? "User"
              : "Command AI";
        return `${label}: ${messageTextFromParts(m.parts).slice(0, 800)}`;
      })
      .join("\n\n");

    const summary = await generateVertexTextCompletion({
      systemInstruction:
        "Summarize this trading chat session for future AI context. Include: goal progress, trades discussed/executed, key decisions, open positions, and next steps. Under 400 words.",
      userPrompt: transcript,
      temperature: 0.2,
      maxTokens: 1024,
    });

    const result = await archiveSessionInPlace(conversationId, user.id, summary.trim());

    return NextResponse.json({
      success: true,
      summary: result.summary,
      sessionNumber: result.sessionNumber,
      dividerMessage: {
        id: result.dividerId,
        role: "system",
        parts: [
          {
            type: "session_divider",
            text: result.summary,
            payload: { sessionNumber: result.sessionNumber },
          },
        ],
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to start new session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
