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
 * Short, human-readable conversation name from the first user message (heuristics — no LLM).
 */
export function synthesizeConversationTitleFromFirstUserText(raw: string): string {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return "New conversation";
  const lower = text.toLowerCase();
  const stripped = lower.replace(/[!?.]+$/g, "").trim();

  if (
    text.length <= 72 &&
    !/\b(stock|price|quote|buy|sell|balance|ticker|btc|eth|nvda|aapl|tsla)\b/i.test(text)
  ) {
    if (/^(hi|hey|yo|hiya|sup)\s*[!.,]*\s*$/i.test(text.trim())) return "Simple greeting";
    if (
      /^(hello|hi there|hey there|good\s+(morning|afternoon|evening)|howdy|what'?s\s+up)\b/i.test(
        stripped,
      ) ||
      (/^(hi|hey|hello)\b/i.test(stripped) && text.length <= 24)
    ) {
      return "Casual greeting";
    }
  }

  if (
    text.length <= 80 &&
    /^(thanks?|thx|thank\s+you|much\s+appreciated|cheers)\b/i.test(stripped)
  ) {
    return "Quick thanks";
  }

  if (
    /\b(price|priced|trading\s+at|quote|quotes|stock|stocks|shares|ticker|how\s+much|market\s+cap|volume|p\/e|earnings|analyze|analysis|chart)\b/i.test(
      text,
    )
  ) {
    const caps = text.match(/\b([A-Z]{2,6}USD|[A-Z]{2,5})\b/g);
    const tick = caps?.find((t) => t.length >= 2 && t.length <= 6);
    if (tick) return `${tick.replace(/USD$/, "")} analysis`;
    if (/\bbitcoin\b|\bbtc\b/i.test(text)) return "Bitcoin analysis";
    if (/\bethereum\b|\beth\b/i.test(text)) return "Ethereum analysis";
    if (/\bnvidia\b|\bnvda\b/i.test(text)) return "NVIDIA question";
    if (/\btesla\b|\btsla\b/i.test(text)) return "Tesla question";
    return "Market analysis";
  }

  if (/\b(should\s+i\s+)?(buy|sell)\b/i.test(lower) || /\border\b|\bposition\b/i.test(lower)) {
    return "Trade question";
  }

  if (/\b(balance|wallet|deposit|withdraw|goal|grow)\b/i.test(lower)) {
    return "Account & goals";
  }

  if (/^how\s+(do|can)\s+i\b/i.test(stripped)) {
    return "How-to question";
  }

  const oneLine = text.replace(/\n+/g, " ").trim();
  if (oneLine.length <= 58) return oneLine;
  return `${oneLine.slice(0, 55)}…`;
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
