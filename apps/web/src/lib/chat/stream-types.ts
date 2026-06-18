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
  | { type: "status"; label: string; detail?: string }
  | { type: "genui"; payload: unknown; source?: string }
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
    };

/** Extract a server-built GenUI payload from a market-data tool result. */
export function extractToolGenui(output: unknown): unknown | null {
  if (!output || typeof output !== "object") return null;
  const genui = (output as { genui?: unknown }).genui;
  return genui && typeof genui === "object" ? genui : null;
}
