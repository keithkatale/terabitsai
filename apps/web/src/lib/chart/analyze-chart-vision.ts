import { getAgentGeminiModelId, getVertexGeminiClient } from "@/lib/gemini/vertex-client";
import { parseVertexErrorMessage } from "@/lib/gemini/vertex-error-parser";
import type { ChartAnalysis, ChartSpec } from "./tradingview-spec";

function parseJsonBlock<T>(raw: string): T | null {
  const match = raw.trim().match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

const DEFAULT_ANALYSIS: ChartAnalysis = {
  bias: "neutral",
  confidence: 0,
  summary: "Unable to parse chart analysis",
  keyLevels: [],
  patterns: [],
  indicatorReads: [],
  invalidation: "N/A",
  confirmation: "N/A",
  reasoning: "Vision model returned unparseable output",
};

/**
 * Send chart PNG to Gemini vision and return structured ChartAnalysis.
 */
export async function analyzeChartVision(
  pngBuffer: Buffer,
  spec: ChartSpec,
): Promise<ChartAnalysis> {
  const ai = getVertexGeminiClient();
  const model = getAgentGeminiModelId();

  const systemInstruction = `You are an expert technical analyst reviewing TradingView charts.
Respond with ONLY valid JSON matching this schema:
{
  "bias": "bullish" | "bearish" | "neutral",
  "confidence": 0-100,
  "summary": "one-line thesis",
  "keyLevels": [{ "price": number, "type": "support"|"resistance"|"pivot", "note": "optional" }],
  "patterns": ["pattern names observed"],
  "indicatorReads": [{ "name": "RSI", "read": "description", "signal": "bullish"|"bearish"|"neutral" }],
  "invalidation": "what would invalidate the thesis",
  "confirmation": "what would confirm the thesis",
  "reasoning": "3-5 sentence detailed analysis"
}
Be precise about price levels visible on the chart. If uncertain, lower confidence.`;

  const userPrompt = `Analyze this TradingView chart:
- Symbol: ${spec.symbol}
- Interval: ${spec.interval}
- Indicators: ${spec.indicators.join(", ")}
- Range: ${spec.range ?? "default"}

Identify trend structure, key support/resistance, indicator signals, and chart patterns.`;

  const base64 = pngBuffer.toString("base64");

  try {
    const res = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { text: userPrompt },
            {
              inlineData: {
                mimeType: "image/png",
                data: base64,
              },
            },
          ],
        },
      ],
      config: {
        systemInstruction,
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    });

    const text =
      res.candidates?.[0]?.content?.parts
        ?.map((p) => (typeof p.text === "string" ? p.text : ""))
        .join("")
        .trim() ?? "";

    const parsed = parseJsonBlock<ChartAnalysis>(text);
    if (!parsed?.bias) return { ...DEFAULT_ANALYSIS, reasoning: text.slice(0, 500) };

    return {
      bias: parsed.bias ?? "neutral",
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 0)),
      summary: String(parsed.summary ?? ""),
      keyLevels: Array.isArray(parsed.keyLevels) ? parsed.keyLevels : [],
      patterns: Array.isArray(parsed.patterns) ? parsed.patterns.map(String) : [],
      indicatorReads: Array.isArray(parsed.indicatorReads) ? parsed.indicatorReads : [],
      invalidation: String(parsed.invalidation ?? ""),
      confirmation: String(parsed.confirmation ?? ""),
      reasoning: String(parsed.reasoning ?? parsed.summary ?? ""),
    };
  } catch (err) {
    throw new Error(parseVertexErrorMessage(err));
  }
}
