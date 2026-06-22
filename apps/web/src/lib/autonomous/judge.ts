import { getLatestCatalystBrief, getMacroRegime } from "@quant/market-intel";
import type { TradeSetup } from "@quant/strategy";
import { generateVertexTextCompletion } from "@/lib/gemini/vertex-text-completion";
import { fetchFundamentals } from "@/lib/chat/tools/macro-tools";
import type { JudgmentResult } from "./types";

function parseJudgment(raw: string): JudgmentResult | null {
  const match = raw.trim().match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as JudgmentResult;
    if (typeof parsed.approved !== "boolean") return null;
    return {
      approved: parsed.approved,
      conviction: Number(parsed.conviction) || 0,
      reasoning: String(parsed.reasoning ?? ""),
      narration: String(parsed.narration ?? parsed.reasoning ?? ""),
    };
  } catch {
    return null;
  }
}

export async function judgeTradeSetup(
  setup: TradeSetup,
  goalContext: { currentBalance: number; targetBalance: number; progressPct: number }
): Promise<JudgmentResult> {
  let catalyst = "";
  let macro = "";
  let fundamentals = "";

  try {
    const brief = await getLatestCatalystBrief(setup.symbol);
    catalyst = brief?.headline ?? brief?.thesis ?? "No catalyst brief";
  } catch {
    catalyst = "Catalyst data unavailable";
  }

  try {
    const regime = await getMacroRegime();
    macro = regime?.regime ?? JSON.stringify(regime);
  } catch {
    macro = "Macro regime unavailable";
  }

  try {
    const fund = await fetchFundamentals(setup.symbol);
    fundamentals = JSON.stringify(fund).slice(0, 500);
  } catch {
    fundamentals = "Fundamentals unavailable";
  }

  const systemInstruction = `You are a senior portfolio manager judging a trade setup.
Respond with ONLY valid JSON:
{
  "approved": true|false,
  "conviction": 0-100,
  "reasoning": "technical brief for audit",
  "narration": "plain English for the user explaining what you did and why"
}

Rules:
- Approve only when technical confluence AND context align.
- Reject if news/macro strongly contradicts the trade direction.
- Be decisive — you are the wealth manager, not an advisor asking permission.`;

  const userPrompt = `Trade setup:
Symbol: ${setup.symbol}
Direction: ${setup.direction}
Entry: ${setup.entry}
Stop: ${setup.atrStop}
Confluence: ${setup.confluenceScore}
Rationale: ${setup.rationale.join("; ")}
Regime: ${setup.regime}
MTF: bias=${setup.timeframeBias}, setup=${setup.timeframeSetup}, trigger=${setup.timeframeTrigger}

Goal context:
Balance: $${goalContext.currentBalance.toFixed(2)} → $${goalContext.targetBalance.toFixed(2)}
Progress: ${goalContext.progressPct.toFixed(1)}%

Catalyst: ${catalyst}
Macro: ${macro}
Fundamentals: ${fundamentals}

Approve or reject this trade.`;

  try {
    const raw = await generateVertexTextCompletion({
      systemInstruction,
      userPrompt,
      temperature: 0.15,
      maxTokens: 512,
    });
    const parsed = parseJudgment(raw);
    if (parsed) return parsed;
  } catch (err) {
    console.warn("[judge] LLM failed:", err);
  }

  if (setup.confluenceScore >= 75) {
    return {
      approved: true,
      conviction: setup.confluenceScore,
      reasoning: "High confluence — auto-approved after LLM unavailable",
      narration: `I'm taking a ${setup.direction} on ${setup.symbol} because ${setup.rationale[0] ?? "multiple signals aligned"}.`,
    };
  }

  return {
    approved: false,
    conviction: setup.confluenceScore,
    reasoning: "LLM judgment unavailable and confluence below auto-approve threshold",
    narration: "I passed on this opportunity — conviction wasn't high enough.",
  };
}

export async function judgeTopSetups(
  setups: TradeSetup[],
  goalContext: { currentBalance: number; targetBalance: number; progressPct: number },
  limit = 3
): Promise<Array<{ setup: TradeSetup; judgment: JudgmentResult }>> {
  const results: Array<{ setup: TradeSetup; judgment: JudgmentResult }> = [];
  for (const setup of setups.slice(0, limit)) {
    const judgment = await judgeTradeSetup(setup, goalContext);
    results.push({ setup, judgment });
    if (judgment.approved) break;
  }
  return results;
}
