import { getCapitalAssetCatalog } from "@/lib/catalog/capital-assets";
import { capitalAdapter } from "@/lib/execution/capital-adapter";
import { isGeminiRuntimeConfigured } from "@/lib/gemini/vertex-client";
import { generateVertexTextCompletion } from "@/lib/gemini/vertex-text-completion";
import { assetClassForSymbol } from "@/lib/market/watchlist";

export type CopilotGreetingContext = {
  symbol: string;
  displayName: string;
  assetClass: string;
  spot?: number;
  change24hPct?: number | null;
};

export type CopilotGreetingResult = {
  headline: string;
  prompts: [string, string, string];
  symbol: string;
  displayName: string;
  source: "ai" | "fallback";
};

const CATALOG = getCapitalAssetCatalog();

function displayNameForSymbol(symbol: string): string {
  const item = CATALOG.find((a) => a.symbol === symbol);
  return (
    item?.display_name.replace(" CFD", "").replace(" / USD", "") ??
    symbol.replace("USD", "")
  );
}

export async function fetchMarketContext(symbol: string): Promise<CopilotGreetingContext> {
  const normalized = symbol.trim().toUpperCase();
  const assetClass = assetClassForSymbol(normalized);
  const displayName = displayNameForSymbol(normalized);

  try {
    const quote = await capitalAdapter.fetchQuote(normalized, assetClass);
    return {
      symbol: quote.symbol.toUpperCase(),
      displayName,
      assetClass,
      spot: quote.spot,
      change24hPct: quote.change24hPct,
    };
  } catch {
    return { symbol: normalized, displayName, assetClass };
  }
}

function trendLabel(change24hPct?: number | null): "up" | "down" | "flat" {
  if (change24hPct == null) return "flat";
  if (change24hPct > 0.75) return "up";
  if (change24hPct < -0.75) return "down";
  return "flat";
}

function formatChange(change24hPct?: number | null): string {
  if (change24hPct == null) return "";
  const sign = change24hPct >= 0 ? "+" : "";
  return `${sign}${change24hPct.toFixed(2)}%`;
}

export function buildFallbackCopilotGreeting(ctx: CopilotGreetingContext): CopilotGreetingResult {
  const { symbol, displayName, spot, change24hPct } = ctx;
  const trend = trendLabel(change24hPct);
  const changeText = formatChange(change24hPct);

  let headline = "How can I help you today?";
  let prompts: [string, string, string];

  if (trend === "up") {
    headline = changeText
      ? `${symbol} is up ${changeText} — explore what's driving the move.`
      : `What's the outlook for ${displayName}?`;
    prompts = [
      `Chart ${symbol} and mark key support if this rally pauses`,
      `Is ${symbol} overextended after today's move?`,
      `Give me a bull-case entry plan for ${symbol}`,
    ];
  } else if (trend === "down") {
    headline = changeText
      ? `${symbol} is down ${changeText} — let's find where buyers may step in.`
      : `Where is ${displayName} finding support?`;
    prompts = [
      `Analyze ${symbol} support levels and downside risk`,
      `Should I wait for a reversal signal on ${symbol}?`,
      `Map stop-loss and target zones for ${symbol}`,
    ];
  } else {
    headline = spot
      ? `${symbol} at ${spot.toLocaleString(undefined, { maximumFractionDigits: spot < 10 ? 4 : 2 })} — what setup is forming?`
      : `What should I watch on ${displayName} right now?`;
    prompts = [
      `Run a full technical read on ${symbol}`,
      `Where are the nearest support and resistance levels for ${symbol}?`,
      `Is ${symbol} setting up for a breakout or range trade?`,
    ];
  }

  return {
    headline,
    prompts,
    symbol,
    displayName,
    source: "fallback",
  };
}

function parseGreetingJson(raw: string): { headline?: string; prompts?: string[] } | null {
  const trimmed = raw.trim();
  const jsonBlock = trimmed.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonBlock) return null;
  try {
    return JSON.parse(jsonBlock) as { headline?: string; prompts?: string[] };
  } catch {
    return null;
  }
}

export async function generateCopilotGreeting(
  ctx: CopilotGreetingContext,
): Promise<CopilotGreetingResult> {
  const fallback = buildFallbackCopilotGreeting(ctx);

  if (!isGeminiRuntimeConfigured()) return fallback;

  const changeText =
    ctx.change24hPct != null ? `${formatChange(ctx.change24hPct)} (24h)` : "unavailable";
  const spotText = ctx.spot != null ? ctx.spot.toLocaleString() : "unavailable";

  try {
    const raw = await generateVertexTextCompletion({
      systemInstruction: `You write concise home-screen copilot greetings for a trading terminal app.
Return ONLY valid JSON: {"headline":"...","prompts":["...","...","..."]}
- headline: one short sentence (max 14 words) referencing the asset and current price action; conversational, not salesy
- prompts: exactly 3 distinct, actionable chat prompts the user can tap (each max 12 words); show what the AI can do (chart analysis, levels, entries, risk)
- Do not invent precise prices beyond what is given`,
      userPrompt: `Asset: ${ctx.symbol} (${ctx.displayName})
Asset class: ${ctx.assetClass}
Spot: ${spotText}
24h change: ${changeText}`,
      temperature: 0.75,
      maxTokens: 512,
    });

    const parsed = parseGreetingJson(raw);
    const prompts = parsed?.prompts?.filter((p) => typeof p === "string" && p.trim()).slice(0, 3);
    const headline = parsed?.headline?.trim();

    if (headline && prompts && prompts.length === 3) {
      return {
        headline,
        prompts: prompts as [string, string, string],
        symbol: ctx.symbol,
        displayName: ctx.displayName,
        source: "ai",
      };
    }
  } catch {
    /* use fallback */
  }

  return fallback;
}
