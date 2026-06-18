import { parseVertexErrorMessage } from "@/lib/gemini/vertex-error-parser";
import { getAgentGeminiModelId, getVertexGeminiClient } from "@/lib/gemini/vertex-client";

/** Single-turn text from Vertex / Google AI Studio (no tools). */
export async function generateVertexTextCompletion(input: {
  userPrompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  try {
    const ai = getVertexGeminiClient();
    const model = getAgentGeminiModelId();

    const res = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: input.userPrompt }] }],
      config: {
        ...(input.systemInstruction ? { systemInstruction: input.systemInstruction } : {}),
        ...(input.temperature != null ? { temperature: input.temperature } : {}),
        ...(input.maxTokens != null ? { maxOutputTokens: input.maxTokens } : {}),
      },
    });

    const part = res.candidates?.[0]?.content?.parts?.[0];
    const text = typeof part?.text === "string" ? part.text.trim() : "";
    if (!text) {
      throw new Error("Vertex returned empty text");
    }
    return text;
  } catch (err) {
    throw new Error(parseVertexErrorMessage(err));
  }
}
