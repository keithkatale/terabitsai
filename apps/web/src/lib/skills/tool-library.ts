/**
 * Maps external/native skills to native Terabits tools and execution modes.
 *
 * execution_mode:
 * - native: implemented in SkillExecutor (TypeScript)
 * - tool: delegate to a single native tool
 * - guidance: inject SKILL.md workflow; LLM uses tools itself
 * - workflow: multi-step YAML workflow from claude-trading-skills
 */

export type ToolExecutionMode = "native" | "tool" | "guidance" | "workflow";

export type SkillToolMapping = {
  skillId: string;
  mode: ToolExecutionMode;
  /** Native tool name when mode=tool */
  tool?: string;
  /** Additional tools the skill may compose */
  companionTools?: string[];
  /** Workflow file relative to skills/external/claude-trading-skills/_workflows */
  workflow?: string;
  category: string;
  marketsTerminal?: boolean;
};

export const SKILL_TOOL_MAPPINGS: SkillToolMapping[] = [
  // ── Native implementations ──
  { skillId: "market-regime-detector", mode: "native", category: "market-regime" },
  { skillId: "position-sizer", mode: "native", category: "risk-management" },
  { skillId: "portfolio-heat-calculator", mode: "native", category: "risk-management" },
  { skillId: "pattern-lookup", mode: "native", category: "knowledge-integration" },
  { skillId: "strategy-recommender", mode: "native", category: "knowledge-integration" },
  {
    skillId: "tradingview-chart-analyst",
    mode: "tool",
    tool: "analyze_chart",
    companionTools: ["query_trading_knowledge", "get_asset_market_data"],
    category: "technical-analysis",
    marketsTerminal: true,
  },

  // ── Claude trading skills → tool delegation ──
  {
    skillId: "technical-analyst",
    mode: "tool",
    tool: "analyze_chart",
    companionTools: ["query_trading_knowledge", "spawn_subagents"],
    category: "technical-analysis",
    marketsTerminal: true,
  },
  {
    skillId: "breakout-trade-planner",
    mode: "guidance",
    companionTools: ["analyze_chart", "get_asset_market_data", "query_trading_knowledge", "execute_skill"],
    category: "trade-planning",
    marketsTerminal: true,
  },
  {
    skillId: "vcp-screener",
    mode: "guidance",
    companionTools: ["get_all_assets", "analyze_chart", "get_asset_market_data"],
    category: "screening",
  },
  {
    skillId: "finviz-screener",
    mode: "guidance",
    companionTools: ["get_all_assets", "search_market_intel"],
    category: "screening",
  },
  {
    skillId: "macro-regime-detector",
    mode: "tool",
    tool: "get_macro_data",
    companionTools: ["search_market_intel", "get_market_overview"],
    category: "market-regime",
  },
  {
    skillId: "market-environment-analysis",
    mode: "guidance",
    companionTools: ["get_macro_data", "get_market_overview", "search_market_intel"],
    category: "market-regime",
  },
  {
    skillId: "market-breadth-analyzer",
    mode: "guidance",
    companionTools: ["get_market_overview", "get_macro_data"],
    category: "market-regime",
  },
  {
    skillId: "sector-analyst",
    mode: "guidance",
    companionTools: ["get_market_overview", "get_fundamentals", "search_market_intel"],
    category: "fundamental",
  },
  {
    skillId: "us-stock-analysis",
    mode: "guidance",
    companionTools: ["get_fundamentals", "analyze_chart", "get_asset_market_data"],
    category: "fundamental",
  },
  {
    skillId: "earnings-trade-analyzer",
    mode: "guidance",
    companionTools: ["get_fundamentals", "search_market_intel", "analyze_chart"],
    category: "events",
  },
  {
    skillId: "options-strategy-advisor",
    mode: "guidance",
    companionTools: ["get_asset_market_data", "query_trading_knowledge"],
    category: "options",
  },
  {
    skillId: "trade-hypothesis-ideator",
    mode: "guidance",
    companionTools: ["analyze_chart", "query_trading_knowledge", "execute_skill"],
    category: "trade-planning",
    marketsTerminal: true,
  },
  {
    skillId: "scenario-analyzer",
    mode: "guidance",
    companionTools: ["analyze_chart", "get_macro_data", "spawn_subagents"],
    category: "planning",
  },
  {
    skillId: "trading-skills-navigator",
    mode: "guidance",
    category: "meta",
  },

  // ── Finance skills ──
  {
    skillId: "tradingview-reader",
    mode: "tool",
    tool: "analyze_chart",
    companionTools: ["get_asset_market_data"],
    category: "data-providers",
    marketsTerminal: true,
  },
  {
    skillId: "yfinance-data",
    mode: "tool",
    tool: "get_fundamentals",
    companionTools: ["get_asset_market_data", "http_request"],
    category: "data-providers",
  },
  {
    skillId: "generative-ui",
    mode: "guidance",
    category: "ui-tools",
  },
  {
    skillId: "options-payoff",
    mode: "guidance",
    companionTools: ["query_trading_knowledge"],
    category: "options",
  },
  {
    skillId: "stock-correlation",
    mode: "guidance",
    companionTools: ["render_comparative_chart", "get_asset_market_data"],
    category: "analysis",
  },
  {
    skillId: "sepa-strategy",
    mode: "guidance",
    companionTools: ["analyze_chart", "query_trading_knowledge"],
    category: "strategy",
    marketsTerminal: true,
  },
];

const MAP_BY_ID = new Map(SKILL_TOOL_MAPPINGS.map((m) => [m.skillId, m]));

export function getSkillToolMapping(skillId: string): SkillToolMapping | undefined {
  return MAP_BY_ID.get(skillId);
}

/** Skills prioritized for Markets terminal chart analyst */
export const MARKETS_TERMINAL_SKILLS = SKILL_TOOL_MAPPINGS.filter((m) => m.marketsTerminal).map(
  (m) => m.skillId,
);

/** Build compact catalog for execute_skill tool description */
export function buildSkillCatalogForPrompt(maxItems = 40): string {
  const lines = SKILL_TOOL_MAPPINGS.slice(0, maxItems).map((m) => {
    const tools = m.tool
      ? `→ ${m.tool}`
      : m.companionTools?.slice(0, 3).join(", ") ?? m.mode;
    return `- ${m.skillId} (${m.category}): ${tools}`;
  });
  return lines.join("\n");
}

/** System prompt section listing markets-relevant skills */
export function buildMarketsSkillCatalogPrompt(): string {
  const terminal = SKILL_TOOL_MAPPINGS.filter((m) => m.marketsTerminal);
  const lines = terminal.map((m) => {
    const via = m.tool
      ? `use \`${m.tool}\``
      : `execute_skill('${m.skillId}') + ${m.companionTools?.join(", ") ?? "guidance"}`;
    return `- **${m.skillId}**: ${via}`;
  });

  return `

AVAILABLE ANALYSIS SKILLS (Markets terminal):
${lines.join("\n")}

Use \`execute_skill\` with these IDs when the SKILL workflow adds structure beyond a raw tool call.
Prefer \`analyze_chart\` first for anything visible on the TradingView chart.`;
}

/** Native tool names used across the trading agent stack */
export const NATIVE_TOOL_CATALOG = {
  marketData: ["get_asset_market_data", "render_asset_chart", "render_comparative_chart", "get_market_overview", "get_all_assets"],
  chartAnalysis: ["analyze_chart", "execute_skill", "execute_workflow"],
  tradingView: ["tradingview_screener", "tradingview_quote", "tradingview_news", "tradingview_search", "tradingview_options_chain"],
  hyperliquid: ["hyperliquid_markets", "hyperliquid_candles", "hyperliquid_book", "hyperliquid_funding"],
  intel: ["search_market_intel", "get_catalyst_brief", "get_macro_data", "get_fundamentals", "web_scrape"],
  knowledge: ["query_trading_knowledge"],
  execution: ["broker_action", "execute_trade", "get_account_state"],
  planning: ["manage_goals", "schedule_task", "spawn_subagents"],
} as const;
