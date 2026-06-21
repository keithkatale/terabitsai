import type { GeneralHeadline } from "../ingest/general-news.js";
import { persistNewsItem } from "../persist.js";
import { persistSynthesisBrief } from "../persist-synthesis.js";

export type ScoutedStory = {
  headline: string;
  summary: string;
  sentiment: "bullish" | "bearish" | "neutral";
  symbols: string[];
  themes: string[];
};

const SYMBOL_HINTS: Array<{ pattern: RegExp; symbol: string }> = [
  { pattern: /\bbitcoin\b|\bbtc\b/i, symbol: "BTCUSD" },
  { pattern: /\bethereum\b|\beth\b/i, symbol: "ETHUSD" },
  { pattern: /\bnvidia\b|\bnvda\b/i, symbol: "NVDA" },
  { pattern: /\bapple\b|\baapl\b/i, symbol: "AAPL" },
  { pattern: /\bgoogle\b|\balphabet\b|\bgoogl\b/i, symbol: "GOOGL" },
  { pattern: /\bmicrosoft\b|\bmsft\b/i, symbol: "MSFT" },
  { pattern: /\bs&p\b|\bsp 500\b|\bus500\b/i, symbol: "US500" },
  { pattern: /\bnasdaq\b|\bus100\b/i, symbol: "US100" },
  { pattern: /\bgold\b|\bxau\b/i, symbol: "GOLD" },
  { pattern: /\boil\b|\b crude\b|\bwti\b/i, symbol: "OIL" },
  { pattern: /\beuro\b|\beurusd\b/i, symbol: "EURUSD" },
  { pattern: /\bsolana\b|\bsol\b/i, symbol: "SOLUSD" },
];

function inferSymbols(text: string, extra: string[] = []): string[] {
  const found = new Set(extra);
  for (const { pattern, symbol } of SYMBOL_HINTS) {
    if (pattern.test(text)) found.add(symbol);
  }
  return [...found];
}

function inferSentiment(text: string): "bullish" | "bearish" | "neutral" {
  const lower = text.toLowerCase();
  const bull = /\b(surge|rally|gain|rise|beat|strong|growth|record high|approval)\b/.test(lower);
  const bear = /\b(fall|drop|decline|miss|weak|cut|layoff|crash|warning|downgrade)\b/.test(lower);
  if (bull && !bear) return "bullish";
  if (bear && !bull) return "bearish";
  return "neutral";
}

function ruleBasedScout(headlines: GeneralHeadline[]): ScoutedStory[] {
  return headlines.slice(0, 8).map((h) => {
    const text = `${h.title} ${h.summary}`;
    return {
      headline: h.title,
      summary: h.summary || h.title,
      sentiment: inferSentiment(text),
      symbols: inferSymbols(text, h.symbols ?? []),
      themes: h.category ? [h.category] : ["markets"],
    };
  });
}

async function scoutWithGemini(headlines: GeneralHeadline[]): Promise<ScoutedStory[] | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || headlines.length === 0) return null;

  const digest = headlines
    .slice(0, 20)
    .map((h, i) => `${i + 1}. [${h.source}] ${h.title}`)
    .join("\n");

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are a financial news scout. From these headlines, pick the 6 most market-moving stories. Return ONLY valid JSON array:
[{"headline":"...","summary":"2 sentences max","sentiment":"bullish|bearish|neutral","symbols":["BTCUSD","NVDA"],"themes":["macro"]}]

Use tradable symbols where possible: BTCUSD, ETHUSD, NVDA, AAPL, US500, US100, GOLD, OIL, EURUSD, etc.

Headlines:
${digest}`,
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
        }),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as ScoutedStory[];
    return parsed.filter((s) => s.headline && s.summary);
  } catch {
    return null;
  }
}

export async function runAiNewsScout(
  headlines: GeneralHeadline[],
  scanRunId: string,
): Promise<number> {
  const geminiStories = await scoutWithGemini(headlines);
  const aiStories = geminiStories ?? ruleBasedScout(headlines);
  const usedGemini = geminiStories !== null;
  let created = 0;

  for (const story of aiStories) {
    const row = await persistNewsItem({
      symbol: story.symbols[0],
      headline: story.headline,
      summary: story.summary,
      sentiment: story.sentiment,
      source: "ai-scout",
      category:
        story.symbols.length > 0 ? `symbols:${story.symbols.join(",")}` : "ai-scout",
      scanRunId,
    });
    if (row) created++;
  }

  if (aiStories.length > 0) {
    const top = aiStories.slice(0, 5);
    await persistSynthesisBrief({
      briefType: "morning",
      symbols: [...new Set(top.flatMap((s) => s.symbols))],
      headline: `AI market scout: ${top.length} stories shaping today's tape`,
      thesis: top.map((s) => `• ${s.headline} (${s.sentiment})`).join(" "),
      bullets: {
        actionable: top.map((s) => s.summary),
        bullish: top.filter((s) => s.sentiment === "bullish").map((s) => s.headline),
        bearish: top.filter((s) => s.sentiment === "bearish").map((s) => s.headline),
      },
      impactScore: Math.min(10, 5 + top.length),
      confidence: usedGemini ? 0.78 : 0.55,
      provenance: headlines.slice(0, 5).map((h) => ({
        source: h.source,
        url: h.url,
        title: h.title,
      })),
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      scanRunId,
    });
  }

  return created;
}
