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
## GENUI & QUANT UI (extended)

The client renders tool \`quant_ui\` / \`genui\` payloads automatically — never paste raw tags or JSON in replies.

GenUI node types: section, grid, stat, metricCard, chart, gauge, progress, barlist, callout, badge, keyValue, table, component, actionButton.
Prefer flat \`{ "view": [ ...nodes ] }\` layouts. Max 8 sparkline points.

Interactive clarification: append \`<interactive-question>\` blocks when you need structured user input before proceeding.
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
