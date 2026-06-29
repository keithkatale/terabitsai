/**
 * Composes the full chat system instruction from modular sections.
 */
import type { AiToolId } from "@/lib/chat/ai-tools";
import { buildAiToolsSystemHint } from "@/lib/chat/ai-tools";
import {
  buildGoalMissionPrompt,
  buildSessionContextPrompt,
  type getSessionContext,
} from "@/lib/chat/conversation-persistence";
import {
  buildMarketsChartContextPrompt,
  type MarketsChartSessionContext,
} from "@/lib/chat/markets-chart-context";
import {
  buildSystemPrompt,
  type AccountProfile,
  type UserPlan,
} from "@/lib/chat/system-prompt";
import type { TradingMode } from "@/lib/chat/conversation-persistence";
import { buildPlanContextPrompt } from "@/lib/subscription/plan-context";
import { buildMarketsSkillCatalogPrompt } from "@/lib/skills/tool-library";
import { buildWorkflowCatalogForPrompt } from "@/lib/skills/workflow-runner";

export type ChatSystemInstructionConfig = {
  tradingMode: TradingMode;
  userPlan: UserPlan;
  isFirstTurn: boolean;
  sessionContext: Awaited<ReturnType<typeof getSessionContext>> | null;
  accountProfile: AccountProfile | null;
  planContext: string;
  profileContext: string;
  creditsContext: string;
  aiTools: AiToolId[];
  marketsChartContext: MarketsChartSessionContext | null;
};

const EXTENDED_OPERATIONAL_RULES = `
## EXTENDED OPERATIONAL RULES

### Chart & data routing
- **Technical analysis / patterns / S&R** → \`analyze_chart\` (TradingView + AI vision)
- **Simple price history** → \`render_asset_chart\` (Capital.com OHLCV)
- **Multi-asset pulse** → \`get_market_overview\`
- **TradingView screener / TV quotes / TV news / options** → \`tradingview_screener\`, \`tradingview_quote\`, \`tradingview_news\`, \`tradingview_options_chain\`
- **Hyperliquid perps (public API)** → \`hyperliquid_markets\`, \`hyperliquid_candles\`, \`hyperliquid_book\`, \`hyperliquid_funding\`
- **Symbol resolution** → \`tradingview_search\`

### Tool failure recovery
If a chart/data tool fails: read the error, retry with corrected params, or use an alternative tool. Never leave the user with a blank error.

### Web research
- \`web_scrape\` — fetch page content from URLs
- \`http_request\` — call public REST APIs

### User updates vs final reply
- Use \`inform_user\` for progress in the live trace only
- Final visible text is the polished answer after tools complete
- Do not output visible text in the same turn as tool calls

### Pinned assets
When a message includes \`<pinned_assets>\`, call \`get_asset_details\` and \`get_asset_market_data\` for every pinned symbol before answering.

### Autonomous wealth manager
When autonomous_trading is ON: execute via \`execute_trade\` / \`broker_action\` — never say you cannot trade.
Messages starting with "[Wealth Monitor]" are orders — execute immediately.

### Workflows & skills
- \`execute_skill(skill_id, inputs)\` — single analysis skill (83+ available)
- \`execute_workflow(workflow_id)\` — multi-step YAML pipeline:
${buildWorkflowCatalogForPrompt().replace(/^/gm, "  ")}
`;

const GENUI_EXTENDED = `
## CANVAS, GENUI & QUANT UI

The client has three rendering systems. Prefer **Canvas** for visual/complex outputs.

### Canvas (Primary for Visual Dashboards)
Use \`\`\`canvas fenced blocks with custom HTML/CSS. Follow \`canvas-design-system.md\` design tokens:
- \`var(--canvas-bg-*)\`, \`var(--canvas-text-*)\`, \`var(--canvas-border-*)\`
- Embed live charts via \`[data-component="AssetPriceChart"]\` slots
- Wire actions via \`[data-action="prompt"]\` buttons
- Responsive CSS Grid layouts
- Dark terminal aesthetic (near-black + cyan/violet accents)

**When to open Canvas**: Complex analysis, multi-asset comparisons, trade dashboards, portfolio reviews.
**Chat only for**: Quick answers (1-2 sentences), clarifications, status updates.

### Quant UI (Auto-rendered from Tools)
Tool outputs return \`quant_ui\` markup (XML \`<quant:chart>\`, etc.). The server injects these as compact bento widgets — never paste raw markup yourself.

### GenUI (Legacy Structured Data)
For backwards compat, \`\`\`genui JSON fences work. Nodes: section, grid, stat, metricCard, chart, gauge, table, actionButton, etc. Prefer flat \`{ "view": [...] }\` layouts. **Prefer Canvas over GenUI for new work.**

Interactive clarification: append \`<interactive-question>\` blocks for structured user input.
`;

export function buildChatSystemInstruction(config: ChatSystemInstructionConfig): string {
  const goalMission = config.sessionContext ? buildGoalMissionPrompt(config.sessionContext) : "";
  const memoryContext = config.sessionContext ? buildSessionContextPrompt(config.sessionContext) : "";

  const firstTurnDirective =
    config.userPlan === "premium" && config.isFirstTurn
      ? `\n\nFIRST TURN: Call manage_goals(list) and get_account_state. Lead with goal setup or progress.`
      : config.isFirstTurn
        ? `\n\nFIRST TURN: Greet the user and understand their objectives. Free/pro = analysis only.`
        : "";

  const marketsChartPrompt = config.marketsChartContext
    ? `${buildMarketsChartContextPrompt(config.marketsChartContext)}${buildMarketsSkillCatalogPrompt()}`
    : "";

  const corePrompt = buildSystemPrompt({
    tradingMode: config.tradingMode,
    userPlan: config.userPlan,
    sessionContext: config.sessionContext
      ? {
          goals: config.sessionContext.goals,
          previousSessions: config.sessionContext.previousSessions,
          sessionNumber: config.sessionContext.sessionNumber,
        }
      : null,
    accountProfile: config.accountProfile,
    isFirstTurn: false,
  });

  const aiToolsHint = buildAiToolsSystemHint(config.aiTools);

  return [
    goalMission,
    firstTurnDirective,
    config.planContext,
    config.profileContext,
    config.creditsContext,
    aiToolsHint,
    marketsChartPrompt,
    corePrompt,
    EXTENDED_OPERATIONAL_RULES,
    GENUI_EXTENDED,
    memoryContext ? `\n## SESSION MEMORY\n${memoryContext}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}
