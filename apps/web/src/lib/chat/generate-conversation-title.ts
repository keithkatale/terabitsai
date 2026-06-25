import { generateVertexTextCompletion } from "@/lib/gemini/vertex-text-completion";
import { synthesizeConversationTitleFromFirstUserText } from "@/lib/chat/conversation-title";

const TITLE_SYSTEM = `You name chat conversations for a trading and markets AI app.
Given the user's first message, create a concise, descriptive title of 2-4 words.

Rules:
- Use title case (e.g., "Bitcoin Analysis", "Trading Strategy")
- NO quotes, punctuation, or emojis
- Capture the core topic or intent
- Be specific but concise
- Never use generic words like "Chat", "Conversation", "Question"

Examples:
- "Hi, how are you?" → "Casual Greeting"
- "What can you help me with?" → "Capabilities Inquiry"  
- "Tell me about NVDA stock performance" → "NVDA Performance"
- "Should I buy Bitcoin now?" → "Bitcoin Trade Advice"
- "How do I set stop losses?" → "Stop Loss Guide"
- "What's the market outlook for tech stocks?" → "Tech Market Outlook"`;

function normalizeLlmTitle(raw: string): string {
  const line = raw
    .trim()
    .split(/\r?\n/)[0]
    ?.replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[.!?]+$/g, "")
    .trim();
  if (!line) return "";
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length > 6) return words.slice(0, 4).join(" ");
  return line.slice(0, 80);
}

/** LLM-generated 2–4 word conversation title from the first user prompt. */
export async function generateConversationTitleWithLlm(firstUserText: string): Promise<string> {
  const prompt = firstUserText.trim().slice(0, 500);
  if (!prompt) return "New conversation";

  try {
    const raw = await generateVertexTextCompletion({
      systemInstruction: TITLE_SYSTEM,
      userPrompt: `User message: "${prompt}"\n\nGenerate title (2-4 words):`,
      temperature: 0.3,
      maxTokens: 20,
    });
    const title = normalizeLlmTitle(raw);
    // Only accept if it's meaningful (not too short, not the full prompt)
    if (title.length >= 3 && title.length <= 50 && title.toLowerCase() !== prompt.toLowerCase().slice(0, 50)) {
      return title;
    }
    console.warn(`[conversation-title] LLM returned invalid title: "${title}"`);
  } catch (err) {
    console.error("[conversation-title] LLM generation failed:", err);
  }

  // Always fall back to smart heuristics
  const fallback = synthesizeConversationTitleFromFirstUserText(prompt);
  console.log(`[conversation-title] Using fallback: "${fallback}" for prompt: "${prompt.slice(0, 60)}..."`);
  return fallback;
}
