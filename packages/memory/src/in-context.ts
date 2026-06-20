/**
 * Tier 0 — In-Context Window Memory
 * Manages a rolling window of recent messages/events to fit within the LLM context limit.
 * Enforces token budgets by truncating older entries while always keeping the system prompt.
 */

export type ContextMessage = {
  role: "system" | "user" | "assistant" | "tool"
  content: string
  timestamp: string
  tokenEstimate?: number
}

const CHARS_PER_TOKEN = 4
const DEFAULT_MAX_TOKENS = 8_000

export class InContextWindow {
  private messages: ContextMessage[] = []
  private readonly maxTokens: number

  constructor(maxTokens = DEFAULT_MAX_TOKENS) {
    this.maxTokens = maxTokens
  }

  add(message: ContextMessage): void {
    const estimate = Math.ceil(message.content.length / CHARS_PER_TOKEN)
    this.messages.push({ ...message, tokenEstimate: estimate })
    this.trim()
  }

  /**
   * Returns all messages within the token budget.
   * System messages are always preserved; oldest user/assistant messages are dropped first.
   */
  getWindow(): ContextMessage[] {
    return this.messages
  }

  /**
   * Builds a formatted context string suitable for LLM prompt injection.
   */
  toPromptString(maxChars = DEFAULT_MAX_TOKENS * CHARS_PER_TOKEN): string {
    const relevant = this.messages
      .filter((m) => m.role !== "system")
      .slice(-20) // Last 20 exchanges max

    const lines = relevant.map((m) => {
      const prefix = m.role === "user" ? "User" : m.role === "tool" ? "Tool" : "Assistant"
      return `[${prefix} @ ${m.timestamp.slice(11, 19)}]: ${m.content.slice(0, 400)}`
    })

    const full = lines.join("\n")
    return full.length > maxChars ? full.slice(-maxChars) : full
  }

  clear(): void {
    // Keep only system messages
    this.messages = this.messages.filter((m) => m.role === "system")
  }

  get tokenCount(): number {
    return this.messages.reduce((sum, m) => sum + (m.tokenEstimate ?? 0), 0)
  }

  private trim(): void {
    while (this.tokenCount > this.maxTokens) {
      // Remove oldest non-system message
      const idx = this.messages.findIndex((m) => m.role !== "system")
      if (idx === -1) break
      this.messages.splice(idx, 1)
    }
  }
}
