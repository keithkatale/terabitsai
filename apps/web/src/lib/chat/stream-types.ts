import type { SubAgentColorScheme } from "@/lib/chat/subagent-types";

export type ChatToolPod = {
  toolUseId: string;
  name: string;
  status: "running" | "done";
  ok?: boolean;
  args?: Record<string, unknown>;
  output?: unknown;
  error?: string;
  durationMs?: number;
};

export type ChatStreamEvent =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "user_update"; message: string }
  | { type: "status"; label: string; detail?: string }
  | { type: "genui"; payload: unknown; source?: string }
  | { type: "quant_ui"; markup: string; source?: string }
  | { type: "canvas"; html: string; title?: string; source?: string }
  | { type: "tool_start"; toolUseId: string; name: string; args?: Record<string, unknown> }
  | {
      type: "tool_end";
      toolUseId: string;
      name: string;
      ok: boolean;
      args?: Record<string, unknown>;
      output?: unknown;
      error?: string;
      durationMs: number;
    }
  | {
      type: "subagent_start";
      id: string;
      prompt: string;
      /** Short user-facing trace — shown on the widget (not the full prompt). */
      assignmentLabel: string;
      color: SubAgentColorScheme;
    }
  | { type: "subagent_reasoning"; id: string; text: string }
  | { type: "subagent_update"; id: string; message: string }
  | { type: "subagent_text"; id: string; text: string }
  | {
      type: "subagent_tool_start";
      id: string;
      toolUseId: string;
      name: string;
      args?: Record<string, unknown>;
    }
  | {
      type: "subagent_tool_end";
      id: string;
      toolUseId: string;
      name: string;
      ok: boolean;
      output?: unknown;
      error?: string;
      durationMs: number;
    }
  | {
      type: "subagent_end";
      id: string;
      status: "done" | "failed";
      report?: string;
      error?: string;
      durationMs: number;
    };

/** Extract a server-built GenUI payload from a market-data tool result. */
export function extractToolGenui(output: unknown): unknown | null {
  if (!output || typeof output !== "object") return null;
  const genui = (output as { genui?: unknown }).genui;
  return genui && typeof genui === "object" ? genui : null;
}

/** Extract Quant UI markup from a tool result. */
export function extractToolQuantUi(output: unknown): string | null {
  if (!output || typeof output !== "object") return null;
  const markup = (output as { quant_ui?: unknown }).quant_ui;
  return typeof markup === "string" && markup.includes("<quant:") ? markup : null;
}

/** Extract canvas HTML from a tool result. */
export function extractToolCanvas(output: unknown): { html: string; title?: string } | null {
  if (!output || typeof output !== "object") return null;
  const obj = output as { canvas?: unknown; canvas_html?: unknown; canvas_title?: unknown };
  const html = typeof obj.canvas === "string" ? obj.canvas : typeof obj.canvas_html === "string" ? obj.canvas_html : null;
  if (!html) return null;
  const title = typeof obj.canvas_title === "string" ? obj.canvas_title : undefined;
  return { html, title };
}
