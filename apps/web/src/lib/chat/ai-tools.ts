export type AiToolId =
  | "searchWeb"
  | "deepResearch"
  | "thinkLonger"
  | "analyzeChart";

export type AiToolDefinition = {
  id: AiToolId;
  name: string;
  shortName: string;
  description: string;
};

export const AI_TOOLS: AiToolDefinition[] = [
  {
    id: "searchWeb",
    name: "Search the web",
    shortName: "Search",
    description: "Pull in live news, headlines, and web sources.",
  },
  {
    id: "deepResearch",
    name: "Run deep research",
    shortName: "Research",
    description: "Multi-step research with broader context gathering.",
  },
  {
    id: "thinkLonger",
    name: "Think for longer",
    shortName: "Think",
    description: "Spend more reasoning time before responding.",
  },
  {
    id: "analyzeChart",
    name: "Analyze chart",
    shortName: "Chart",
    description: "Run technical chart analysis on tagged assets.",
  },
];

export function parseAiTools(raw: unknown): AiToolId[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(AI_TOOLS.map((t) => t.id));
  return raw.filter((id): id is AiToolId => typeof id === "string" && allowed.has(id as AiToolId));
}

export function augmentMessageWithAiTools(message: string, tools: AiToolId[]): string {
  if (tools.length === 0) return message;
  const labels = tools
    .map((id) => AI_TOOLS.find((t) => t.id === id)?.name ?? id)
    .join(", ");
  return `${message}\n\n[User enabled AI tools for this turn: ${labels}. Honor these capabilities when responding.]`;
}

export function buildAiToolsSystemHint(tools: AiToolId[]): string {
  if (tools.length === 0) return "";
  const lines = tools.map((id) => {
    const tool = AI_TOOLS.find((t) => t.id === id);
    if (!tool) return "";
    switch (id) {
      case "searchWeb":
        return "- SEARCH WEB: Use web search / market intel tools for fresh external context before answering.";
      case "deepResearch":
        return "- DEEP RESEARCH: Delegate to sub-agents or run a thorough multi-source research pass; cite findings.";
      case "thinkLonger":
        return "- THINK LONGER: Reason step-by-step internally before the visible reply; be thorough, not rushed.";
      case "analyzeChart":
        return "- ANALYZE CHART: Call analyze_chart / render_asset_chart for tagged or discussed assets.";
      default:
        return `- ${tool.name.toUpperCase()}: ${tool.description}`;
    }
  });
  return `\n\nUSER-ENABLED TOOLS THIS TURN:\n${lines.filter(Boolean).join("\n")}`;
}
