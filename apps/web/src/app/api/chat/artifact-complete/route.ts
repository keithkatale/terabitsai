import { z } from "zod";
import { generateVertexTextCompletion } from "@/lib/gemini/vertex-text-completion";
import { isGeminiRuntimeConfigured } from "@/lib/gemini/vertex-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const requestSchema = z.object({
  prompt: z.string().min(1).max(4000),
  context: z.string().max(8000).optional(),
});

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

  const { prompt, context } = parsed;

  if (!isGeminiRuntimeConfigured()) {
    return Response.json({
      text: `[Demo mode] Received: ${prompt.slice(0, 200)}${prompt.length > 200 ? "…" : ""}`,
    });
  }

  try {
    const userPrompt = context
      ? `Context:\n${context}\n\nTask:\n${prompt}`
      : prompt;

    const text = await generateVertexTextCompletion({
      userPrompt,
      systemInstruction:
        "You are a concise assistant embedded inside an interactive trading artifact. Reply in plain text only — no markdown fences, no XML. Keep answers short (under 400 words) unless the task requires more detail.",
      temperature: 0.4,
      maxTokens: 1024,
    });

    return Response.json({ text });
  } catch (error) {
    console.error("[POST /api/chat/artifact-complete] Failed:", error);
    return Response.json({ error: "Completion failed" }, { status: 500 });
  }
}
