export type ChatHistoryTurn = {
  role: "user" | "assistant";
  content: string;
};

type HistoryPart = {
  type: string;
  text?: string;
  payload?: unknown;
};

type HistoryMessage = {
  role: "user" | "assistant" | "system";
  parts: HistoryPart[];
};

const MAX_HISTORY_TURNS = 40;
const MAX_HISTORY_CHARS = 120_000;

/** Flatten a stored chat message into a single string for model context. */
export function flattenMessageForHistory(message: HistoryMessage): string | null {
  if (message.role !== "user" && message.role !== "assistant") return null;

  const chunks: string[] = [];
  for (const part of message.parts) {
    if (part.type === "text" && part.text?.trim()) {
      chunks.push(part.text.trim());
    } else if (part.type === "genui") {
      chunks.push("[Rendered interactive dashboard / chart UI]");
    } else if (part.type === "trade-execution" && part.text?.trim()) {
      chunks.push(`[Trade confirmation: ${part.text.trim().slice(0, 400)}]`);
    }
    // Omit reasoning — internal chain-of-thought, not user-visible context.
  }

  const content = chunks.join("\n\n").trim();
  return content || null;
}

export function buildHistoryFromMessages(messages: HistoryMessage[]): ChatHistoryTurn[] {
  const turns: ChatHistoryTurn[] = [];
  for (const msg of messages) {
    const content = flattenMessageForHistory(msg);
    if (!content) continue;
    if (msg.role === "user" || msg.role === "assistant") {
      turns.push({ role: msg.role, content });
    }
  }
  return trimHistory(turns);
}

export function trimHistory(history: ChatHistoryTurn[]): ChatHistoryTurn[] {
  let trimmed = history.slice(-MAX_HISTORY_TURNS);

  let total = trimmed.reduce((n, t) => n + t.content.length, 0);
  while (total > MAX_HISTORY_CHARS && trimmed.length > 1) {
    const removed = trimmed.shift();
    if (removed) total -= removed.content.length;
  }

  return trimmed;
}

export function parseClientHistory(raw: unknown): ChatHistoryTurn[] {
  if (!Array.isArray(raw)) return [];

  const turns: ChatHistoryTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: string }).role;
    const content = (item as { content?: string }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const trimmed = content.trim();
    if (!trimmed) continue;
    turns.push({ role, content: trimmed });
  }

  return trimHistory(turns);
}

/** Build Gemini `contents` array from prior turns plus the latest user message. */
export function toGeminiContents(history: ChatHistoryTurn[], latestUserMessage: string): Array<{
  role: "user" | "model";
  parts: Array<{ text: string }>;
}> {
  const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

  for (const turn of history) {
    contents.push({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    });
  }

  contents.push({ role: "user", parts: [{ text: latestUserMessage }] });
  return contents;
}

/** Compact prior turns for simulate-mode keyword / context matching. */
export function historyContextBlob(history: ChatHistoryTurn[], maxTurns = 6): string {
  return history
    .slice(-maxTurns)
    .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`)
    .join("\n");
}
