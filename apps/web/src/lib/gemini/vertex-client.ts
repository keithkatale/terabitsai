import { GoogleGenAI } from "@google/genai";

const TRUEISH = new Set(["1", "true", "yes", "on"]);

function envTrue(key: string): boolean {
  const v = process.env[key];
  if (v === undefined || v === "") return false;
  return TRUEISH.has(String(v).trim().toLowerCase());
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is not set — required for Vertex Gemini`);
  return v;
}

/** Vertex vs Google AI Studio (matches common Gemini deployment env vars). */
export function isVertexLlmBackend(): boolean {
  return envTrue("GOOGLE_GENAI_USE_VERTEXAI") || envTrue("USE_VERTEX_LLM");
}

/** When false, Gemini runs without native thought streaming (smaller payloads / compatibility). */
export function geminiIncludeThoughts(): boolean {
  const v = process.env.GEMINI_INCLUDE_THOUGHTS?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return true;
}

function normalizeVertexModelIdForGenAiSdk(model: string): string {
  const m = model.trim();
  if (!isVertexLlmBackend()) return m;
  if (m.startsWith("publishers/") || m.startsWith("projects/") || m.includes("/")) {
    return m;
  }
  if (/^claude/i.test(m)) return `anthropic/${m}`;
  return m;
}

export function getAgentGeminiModelId(): string {
  const raw =
    process.env.AGENT_LLM_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    "gemini-2.5-flash-preview-05-20";
  return normalizeVertexModelIdForGenAiSdk(raw);
}

/** Check if model supports Gemini native tools (Google Search, URL Context, Code Execution). */
export function modelSupportsGeminiNativeTools(model: string): boolean {
  const m = model.toLowerCase();
  // Claude and other partner models don't support Gemini's native builtin tools
  if (m.includes("claude") || m.includes("anthropic")) return false;
  if (m.includes("publishers/anthropic")) return false;
  // Gemini models support native tools
  return m.includes("gemini");
}

/**
 * Google Gemini via Vertex (ADC / service account) or Google AI Studio (`GEMINI_API_KEY`).
 */
export function getVertexGeminiClient(): GoogleGenAI {
  if (isVertexLlmBackend()) {
    const project = requireEnv("GOOGLE_CLOUD_PROJECT");
    const location = process.env.GOOGLE_CLOUD_LOCATION?.trim() || "us-central1";
    return new GoogleGenAI({
      vertexai: true,
      project,
      location,
    });
  }
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "Configure Vertex (GOOGLE_GENAI_USE_VERTEXAI=true + GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION with ADC), or set GEMINI_API_KEY for Google AI Studio.",
    );
  }
  return new GoogleGenAI({ apiKey: key });
}

/** True when `getVertexGeminiClient()` can be constructed without throwing (for `/api/chat` preflight). */
export function isGeminiRuntimeConfigured(): boolean {
  if (process.env.GEMINI_API_KEY?.trim()) return true;
  if (isVertexLlmBackend() && process.env.GOOGLE_CLOUD_PROJECT?.trim()) return true;
  return false;
}
