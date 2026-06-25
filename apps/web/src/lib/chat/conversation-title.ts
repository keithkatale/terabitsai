/** Titles replaced once the first user message is saved. */
export const PLACEHOLDER_CONVERSATION_TITLES = new Set([
  "",
  "conversation",
  "new conversation",
  "saved chat",
]);

export function isPlaceholderConversationTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  if (PLACEHOLDER_CONVERSATION_TITLES.has(normalized)) return true;
  return /^session \d+$/.test(normalized);
}

/**
 * Smart heuristic conversation title (never returns raw user text).
 * Fallback for when LLM title generation fails.
 */
export function synthesizeConversationTitleFromFirstUserText(raw: string): string {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return "New conversation";
  const lower = text.toLowerCase();
  const stripped = lower.replace(/[!?.]+$/g, "").trim();

  // Greetings
  if (/^(hi|hey|yo|hiya|sup)\s*[!.,]*\s*$/i.test(text.trim())) return "Casual greeting";
  if (
    /^(hello|hi there|hey there|good\s+(morning|afternoon|evening)|howdy|what'?s\s+up)\b/i.test(
      stripped,
    ) ||
    (/^(hi|hey|hello)\b/i.test(stripped) && text.length <= 32)
  ) {
    return "General greeting";
  }

  // Thanks
  if (/^(thanks?|thx|thank\s+you|much\s+appreciated|cheers)\b/i.test(stripped)) {
    return "Acknowledgment";
  }

  // Questions about capabilities, features, what the AI can do
  if (
    /\b(what\s+(can|do|are)\s+you|capabilities|features|help\s+me|able\s+to|support)\b/i.test(
      lower,
    )
  ) {
    return "Capabilities inquiry";
  }

  // "Explain" or "What is" questions
  if (/^(explain|what\s+is|what\s+are|define|describe)\b/i.test(stripped)) {
    return "Information request";
  }

  // Market/trading analysis with tickers
  if (
    /\b(price|priced|trading\s+at|quote|quotes|stock|stocks|shares|ticker|market\s+cap|volume|p\/e|earnings|analyze|analysis|chart)\b/i.test(
      text,
    )
  ) {
    const caps = text.match(/\b([A-Z]{2,6}USD|[A-Z]{2,5})\b/g);
    const tick = caps?.find((t) => t.length >= 2 && t.length <= 6);
    if (tick) return `${tick.replace(/USD$/, "")} inquiry`;
    if (/\bbitcoin\b|\bbtc\b/i.test(text)) return "Bitcoin discussion";
    if (/\bethereum\b|\beth\b/i.test(text)) return "Ethereum discussion";
    if (/\bnvidia\b|\bnvda\b/i.test(text)) return "NVIDIA analysis";
    if (/\btesla\b|\btsla\b/i.test(text)) return "Tesla analysis";
    return "Market inquiry";
  }

  // Trading actions
  if (/\b(should\s+i\s+)?(buy|sell|trade)\b/i.test(lower)) {
    return "Trading advice";
  }
  if (/\b(order|position|entry|exit|stop\s+loss|take\s+profit)\b/i.test(lower)) {
    return "Trade setup";
  }

  // Account, portfolio, wallet
  if (/\b(balance|wallet|deposit|withdraw|portfolio|account)\b/i.test(lower)) {
    return "Account management";
  }
  if (/\b(goal|grow|target|profit|strategy)\b/i.test(lower)) {
    return "Investment goals";
  }

  // How-to questions
  if (/^(how\s+(do|can|to)|can\s+i|is\s+it\s+possible)\b/i.test(stripped)) {
    return "How-to question";
  }

  // Strategy and planning
  if (/\b(strategy|plan|approach|method|technique)\b/i.test(lower)) {
    return "Strategy discussion";
  }

  // Risk and analysis
  if (/\b(risk|volatile|safe|dangerous|careful)\b/i.test(lower)) {
    return "Risk assessment";
  }

  // News and events
  if (/\b(news|announcement|event|catalyst|update|report)\b/i.test(lower)) {
    return "Market news";
  }

  // Comparison questions
  if (/\b(vs|versus|compare|comparison|difference|better)\b/i.test(lower)) {
    return "Comparison inquiry";
  }

  // Default: Extract key meaningful words (never return full user text)
  const words = text
    .split(/\s+/)
    .filter((w) => w.length > 3 && !/^(the|this|that|with|from|what|when|where|why|how)$/i.test(w))
    .slice(0, 3);

  if (words.length >= 2) {
    return words.join(" ");
  }

  // Last resort: generic but descriptive
  if (text.includes("?")) return "User inquiry";
  if (text.length < 30) return "Quick question";
  return "General discussion";
}

export function shouldUpgradeTitleWithLlm(currentTitle: string, firstUserText: string): boolean {
  if (isPlaceholderConversationTitle(currentTitle)) return true;
  const heuristic = synthesizeConversationTitleFromFirstUserText(firstUserText);
  return currentTitle.trim().toLowerCase() === heuristic.trim().toLowerCase();
}

export function resolveConversationTitleAfterFirstUserMessage(
  firstUserText: string,
  currentTitle: string,
): string {
  const first = firstUserText.trim();
  if (!first) return currentTitle;
  if (!isPlaceholderConversationTitle(currentTitle)) return currentTitle;
  return synthesizeConversationTitleFromFirstUserText(first);
}
