import type { ParsedInteractiveQuestion } from "@/lib/chat/interactive-question-helper";
import type { ChatHistoryTurn } from "@/lib/chat/conversation-history";

const TICKER_RE = /\b([A-Z]{2,6}(?:USD|EUR|GBP|JPY)?|\bUS\d{2,3}\b|GOLD|SILVER|OIL)\b/g;

function extractSymbols(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(TICKER_RE)) {
    const sym = match[1]?.toUpperCase();
    if (sym && sym.length >= 2) found.add(sym);
  }
  return [...found];
}

function lastDiscussedSymbol(turns: ChatHistoryTurn[]): string | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const syms = extractSymbols(turns[i].content);
    if (syms.length > 0) return syms[0];
  }
  return null;
}

function lastUserMessage(turns: ChatHistoryTurn[]): string {
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role === "user") return turns[i].content.toLowerCase();
  }
  return "";
}

/** Rule-based follow-ups when the predictor LLM is unavailable. */
export function buildHeuristicFollowUps(input: {
  turns: ChatHistoryTurn[];
  activeSymbol?: string;
  openPositionSymbols?: string[];
  walletAvailable?: number;
  tradingMode?: "demo" | "live";
}): ParsedInteractiveQuestion {
  const { turns, activeSymbol, openPositionSymbols = [], walletAvailable, tradingMode = "demo" } = input;
  const symbol = lastDiscussedSymbol(turns) ?? activeSymbol ?? openPositionSymbols[0] ?? "BTCUSD";
  const userText = lastUserMessage(turns);
  const options: { value: string; label: string }[] = [];

  const push = (value: string, label: string) => {
    if (options.length >= 4) return;
    if (options.some((o) => o.value === value)) return;
    options.push({ value, label });
  };

  if (/compare|vs|versus/.test(userText)) {
    push(
      `Run a side-by-side technical comparison on ${symbol} vs its closest peer`,
      "Compare vs peer",
    );
  }

  if (/chart|price|candle|ohlc|trend/.test(userText)) {
    push(`Show a 1M chart and key support/resistance for ${symbol}`, "Extend chart view");
    push(`Search market intel for catalysts moving ${symbol} today`, "Latest catalysts");
  } else if (/intel|news|catalyst|headline|why/.test(userText)) {
    push(`Summarize verified intel for ${symbol} with source links`, "Deep intel brief");
    push(`Show ${symbol} price action and risk levels`, "Chart + levels");
  } else if (/trade|buy|sell|long|short|position|execute/.test(userText)) {
    push(
      `Draft a ${tradingMode} trade plan for ${symbol} with stop-loss and take-profit`,
      "Trade plan with stops",
    );
    push(`Run subagents to stress-test a ${symbol} entry before execution`, "Risk review team");
  } else if (/portfolio|allocation|holdings|balance|wallet/.test(userText)) {
    if (openPositionSymbols.length > 0) {
      push(
        `Review my open ${openPositionSymbols.slice(0, 3).join(", ")} positions and suggest adjustments`,
        "Review open positions",
      );
    }
    if ((walletAvailable ?? 0) > 0) {
      push(
        "Recommend how to deploy available margin across 2–3 assets with risk caps",
        "Deploy available cash",
      );
    }
    push("Show a market overview of top movers today", "Market overview");
  } else if (/catalog|assets|list|browse|markets/.test(userText)) {
    push(`Analyze ${symbol} with live chart and agent team summary`, `Analyze ${symbol}`);
    push("Compare crypto majors BTCUSD, ETHUSD, and SOLUSD", "Compare crypto majors");
  } else {
    push(`Perform a technical and intel analysis on ${symbol}`, `Analyze ${symbol}`);
    push(`Search market intel — what could move ${symbol} next?`, "Intel scan");
    push(
      `Spawn subagents to analyze ${symbol} (technical, risk, sentiment)`,
      "Agent team deep dive",
    );
  }

  if (openPositionSymbols.length > 0 && !/portfolio|position|holdings/.test(userText)) {
    push(
      `Show P&L and risk on my ${openPositionSymbols[0]} position`,
      "Check open position",
    );
  }

  if (options.length < 2) {
    push("Give me a market overview of BTCUSD, ETHUSD, US100, and GOLD", "Market overview");
    push("What is the agent team watching today?", "Agent watchlist");
  }

  return {
    id: `heuristic-${Date.now()}`,
    type: "single-select",
    title: "Continue with",
    description: "Tap a suggestion to send it as your next message.",
    options: options.slice(0, 4),
  };
}
