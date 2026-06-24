/**
 * Sentiment context for markets AI panel (server-side).
 */

import { getMacroRegime } from "@quant/market-intel";

export type SentimentSnapshot = {
  symbol: string;
  regime: "risk_on" | "risk_off" | "neutral";
  headline: string;
  bullets: string[];
};

export async function fetchSentimentSnapshot(symbol: string): Promise<SentimentSnapshot> {
  try {
    const data = await getMacroRegime();
    const regime =
      data?.regime === "risk_on" || data?.regime === "risk_off" ? data.regime : "neutral";
    const themes = Array.isArray(data?.themes)
      ? (data.themes as string[]).slice(0, 3).join(", ")
      : "";
    return {
      symbol,
      regime,
      headline: themes ? `Macro themes: ${themes}` : "Macro regime context loaded",
      bullets: [
        `Current macro regime: ${regime.replace("_", " ")}`,
        "Cross-check chart bias against broader market conditions.",
      ],
    };
  } catch {
    return {
      symbol,
      regime: "neutral",
      headline: "Sentiment data unavailable — rely on chart structure.",
      bullets: [
        "Monitor volume expansion on breakouts.",
        "Watch for divergence on momentum indicators.",
      ],
    };
  }
}

export function formatSentimentForPrompt(snap: SentimentSnapshot): string {
  return [snap.headline, ...snap.bullets.map((b) => `- ${b}`)].join("\n");
}
