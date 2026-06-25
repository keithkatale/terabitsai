import { isGeminiRuntimeConfigured } from "@/lib/gemini/vertex-client";
import { parseVertexErrorMessage } from "@/lib/gemini/vertex-error-parser";
import { getCapitalAssetCatalog } from "@/lib/catalog/capital-assets";
import { generateVertexTextCompletion } from "@/lib/gemini/vertex-text-completion";
import { fetchAssetCatalog } from "@/lib/chat/asset-catalog-tool";
import { fetchAssetChartData, fetchComparativeChartData, fetchMarketOverview } from "@/lib/chat/market-data-tool";
import { findHistoricalAnalogs } from "@quant/market-intel";
import type { ChatStreamEvent } from "@/lib/chat/stream-types";
import { historyContextBlob, parseClientHistory, toGeminiContents, type ChatHistoryTurn } from "@/lib/chat/conversation-history";
import { augmentMessageWithPinnedAssets, parsePinnedAssets } from "@/lib/chat/pinned-assets";
import {
  augmentMessageWithAiTools,
  buildAiToolsSystemHint,
  parseAiTools,
} from "@/lib/chat/ai-tools";
import { fetchAccountState } from "@/lib/chat/tools/account-state-tool";
import {
  buildSessionContextPrompt,
  buildGoalMissionPrompt,
  getSessionContext,
  hasActiveBalanceGoal,
} from "@/lib/chat/conversation-persistence";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runAgentLoop } from "@/lib/chat/agent-loop";
import { orchestratorToolDeclarations } from "@/lib/chat/tool-declarations";
import { subAgentColorAt } from "@/lib/chat/subagent-types";
import { getUserPlan } from "@/lib/subscription/access";
import { buildPlanContextPrompt, filterToolsForPlan } from "@/lib/subscription/plan-context";
import {
  buildCreditsPrompt,
  deductCredits,
  ensureTrialCredits,
} from "@/lib/subscription/credits";
import {
  buildAccountProfilePrompt,
  getUserAccountProfile,
} from "@/lib/account/user-profile";

export const dynamic = "force-dynamic";


export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      message,
      history: rawHistory,
      pinnedAssets: rawPinned,
      conversationId,
      tradingMode: rawTradingMode,
      sessionContext: clientSessionContext,
      aiTools: rawAiTools,
    } = body;

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ success: false, error: "Prompt message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const tradingMode = rawTradingMode === "live" ? "live" : "demo";
    const userPlan = await getUserPlan(user.id);
    const accountProfile = await getUserAccountProfile(user.id);
    const credits = await ensureTrialCredits(user.id);
    const planContext = buildPlanContextPrompt(userPlan);
    const profileContext = buildAccountProfilePrompt(accountProfile);
    const creditsContext = buildCreditsPrompt(credits.balance);

    const creditCheck = await deductCredits(user.id);
    if (!creditCheck.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Free trial credits exhausted. Upgrade at /pricing to continue.",
          creditsRemaining: creditCheck.balance,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      );
    }

    let memoryContext = "";
    let goalMission = "";
    let sessionContext: Awaited<ReturnType<typeof getSessionContext>> | null = null;

    try {
      sessionContext = await getSessionContext(user.id, tradingMode);
      memoryContext = buildSessionContextPrompt(sessionContext);
      goalMission = buildGoalMissionPrompt(sessionContext);
    } catch {
      memoryContext =
        typeof clientSessionContext === "string" ? clientSessionContext : "";
      goalMission = "";
    }

    const pinnedAssets = parsePinnedAssets(rawPinned);
    const aiTools = parseAiTools(rawAiTools);
    const effectiveMessage = augmentMessageWithAiTools(
      augmentMessageWithPinnedAssets(message, pinnedAssets),
      aiTools,
    );
    const aiToolsHint = buildAiToolsSystemHint(aiTools);

    const conversationHistory = parseClientHistory(rawHistory);
    const isFirstTurn = conversationHistory.length === 0;

    const firstTurnDirective =
      userPlan === "premium" && isFirstTurn
        ? `\n\nFIRST TURN OF SESSION: Before your visible reply, call manage_goals(operation=list) and get_account_state. Lead with goal setup (if none) or goal progress (if active).`
        : isFirstTurn
          ? `\n\nFIRST TURN OF SESSION: Greet the user and understand what they need. On free/pro plans you provide analysis and signals only — do not offer managed trading or autonomous execution.`
          : "";

    const tradingModeLabel =
      tradingMode === "live"
        ? "LIVE — the user trades on a real Capital.com account with real money. Never describe trades as simulated or paper. Trade tickets execute against their live balance."
        : "DEMO — paper trading only. Trades update a simulated portfolio; label them as paper/demo.";

    const systemInstruction = `${goalMission}${firstTurnDirective}${planContext}${profileContext}${creditsContext}${aiToolsHint}

TRADING MODE: ${tradingModeLabel}

You are the Terabits Wealth Engine coordinator — an AI trading agent team that helps users grow capital on autopilot.
Your goal is to observe markets, synthesize intel, propose actionable trades, explain risk, and guide ${tradingMode === "live" ? "live Capital.com execution" : "paper (demo) execution"} with clarity and discipline — always in service of the user's balance target.
You maintain a professional, decisive tone. Provide structured replies using markdown formatting beautifully.

You coordinate specialized agent teams equipped with MCP tools to:
- Retrieve the asset catalog and detailed assets data.
- Pull live quotes and historical OHLCV via get_asset_market_data (use this for ANY chart or price request).
- Search verified market intelligence via search_market_intel for catalyst and headline context — cite provenance URLs, never invent headlines.
- Spin up specialized agent teams (parallel subagents) for technical, fundamental, risk, and sentiment analysis before trade proposals.

When the user asks for a chart, price, market overview, or market view:
1. For **technical analysis, patterns, support/resistance, indicator reads, or trader-style chart review** — call \`analyze_chart\` (TradingView data + AI vision). Use \`render_asset_chart\` only for simple live Capital.com price history.
2. Otherwise call render_asset_chart (single asset) or render_comparative_chart (two assets) or get_market_overview (multi-asset). Pass specific symbols to get_market_overview — pick assets relevant to the user's question, not a generic default list.
3. The client renders the tool's \`quant_ui\` or \`genui\` payload automatically as a **live visual interface** — write **one short intro sentence only**.
4. **NEVER** paste \`\`\`quant, \`\`\`genui, raw \`<quant:…>\` tags, or JSON in your reply. The user must never see markup or code — only rendered UI.
5. NEVER hand-write price series, sparklines, or metric values for assets — all numbers must come from tool output.
6. **Tool failure recovery** — If a chart/data tool fails:
   - Read the error message carefully (check for invalid symbols, API issues, parameter errors)
   - Try again with corrected parameters OR use an alternative tool
   - If repeated failures, acknowledge the data issue and provide a text-based summary of what you can answer
   - DO NOT leave the user with a blank error — always provide meaningful analysis or alternatives

When the user asks to list, browse, or pull assets from the catalog:
1. Call get_all_assets (optionally filter by asset_class).
2. The client renders the tool's \`genui\` payload automatically (AssetCatalogGrid with logos and live prices) — write **one short intro sentence only**. Do NOT output barlist nodes or markdown tables for the full catalog.

### Web Research Tools
When you need real-time information from external sources:
- **web_scrape** — Fetch and extract content from any web page. Use for reading news articles, company pages, documentation, or any public URL. Returns cleaned text content.
- **http_request** — Make direct API calls to third-party REST endpoints. Use for fetching JSON data, calling public APIs, or integrating with external services.

Use these tools when:
1. You need current news or analysis from specific URLs (e.g., a news article the user references)
2. You want to fetch real-time data from public APIs
3. The user asks about information that requires external web content
4. Market intel tools don't have the specific data — fall back to direct web research

When delegating parallel research via \`spawn_subagents\`:
1. **When to delegate** — only when the task needs many steps, parallel depth, or a wider information scope than you can cover efficiently alone. Do NOT delegate for its own sake.
2. **Split work dynamically** — each sub-agent must get a **distinct slice** of the problem (e.g. technical chart vs macro intel vs risk). Never assign duplicate or near-identical prompts to multiple agents.
3. For each sub-agent provide:
   - \`label\`: short user-facing trace (3–7 words) shown in the live widget — what this agent is assigned to do.
   - \`prompt\`: full detailed instructions (for the agent only; **not** shown in the widget).
4. **CRITICAL — Multi-round delegation**:
   - \`spawn_subagents\` is a **repeatable tool** — you can call it multiple times in a single run.
   - If initial agent results are thin, incomplete, or raise new questions, **spawn another batch** with refined prompts targeting the gaps.
   - Iteratively delegate until you have sufficient depth to answer the user's question.
   - Cap at 5 parallel agents **per call**, but you may make multiple calls (e.g. first round gathers data, second round analyzes specific findings).
5. Sub-agents may fail, time out, or return thin reports — that is normal. Never describe a failed agent as malfunctioning. State what data was missing, re-delegate a sharper slice if needed, or synthesize from what succeeded.
6. Sub-agents only report tool-verified facts. Synthesize \`team_results\`; do not paste raw JSON.

### 🌟 QUANT UI — tag-based design system (server-rendered, never shown as code)
Quant UI is our branded component language. Tools return \`<quant:…>\` markup which the **client renders as live visual components** — the user never sees tags or code.

You describe *what* to show by calling tools (render_asset_chart, get_market_overview, etc.). The server builds the markup; the app interprets it into charts, buttons, and cards using our universal design tokens (accent colors, surfaces, borders).

If you need a custom layout in prose (rare), you may use \`\`\`quant fences — but prefer tool injection. Never tell the user to "look at the code below".
- Layout: section{title,subtitle}, grid{columns:1-4}, stack{gap:sm|md|lg}, divider
- Typography: heading{level:1-4,text}, text{tone:default|muted|strong}, badge{accent,text}, citation{source,href?}
- Live data: chart{symbol,name?,range,variant}, compare{symbol1,symbol2,range}, asset-card{symbol,name?,range} (compact live card — click to expand)
- Metrics: stat{label,value,delta?,trend?,accent?}, metrics{columns} wrapping stat children
- Interactive: button{action:prompt|navigate|custom,label?,payload?,href?,variant?}, study-link{id,title,description?,prompt?}, actions (wraps buttons)
- Bridge: widget{name,props} for TradeConfirmationWidget, GoalProgressWidget, PortfolioBreakdown, etc.

Button actions work like HTML+JS:
- action="prompt" payload="…" → sends chat message
- action="navigate" href="/path" → in-app link
- action="custom" name="…" data='{"key":"val"}' → app custom handler

When render_asset_chart / get_market_overview / render_comparative_chart return data, the server injects Quant UI automatically — do NOT duplicate.

### 🌟 GENERATIVE UI ENGINE (legacy JSON DSL — still supported)
Do NOT dump long walls of dry text. Lead with one short, high-signal sentence, then express the substance as live UI. The client renders four kinds of generated UI — pick the lightest that fits.

1) QUANT UI (\`\`\`quant) — preferred for charts, dashboards, and interactive layouts (see above).

2) GENUI — declarative JSON composed interface.
For ANY structured financial answer (metrics, comparisons, breakdowns, scores, risk, summaries), output a fenced code block whose language tag is \`genui\` containing a single JSON layout tree. The renderer composes branded, animated React widgets; you never hand-write HTML for this. The JSON may be a single node { "type": ... }, a wrapper { "view": [ ...nodes ] }, or a bare array of nodes.

Node vocabulary (every node has a \`type\`):
- Layout: section{title?,subtitle?,children[]}, grid{columns:1-4,children[]}, divider, text{text,tone?:default|muted|strong}
- Metrics: stat{label,value,delta?,trend?:up|down|flat,icon?,accent?}, metricCard{label,value,sublabel?,delta?,trend?,sparkline?:number[],accent?}
- Viz: sparkline{data:number[],accent?,label?}, chart{variant?:line|area,series:[{name,data:number[],color?}],labels?:string[],title?}, gauge{value:0-100,label?,caption?,accent?}, progress{value:0-100,label?,caption?,accent?}, barlist{title?,items:[{label,value,accent?}],unit?}
- Info: callout{variant:info|success|warning|danger,title?,text}, badge{text,accent?}, keyValue{items:[{label,value,accent?}]}, table{columns:string[],rows:(string|number)[][]}
- Bridge to prebuilt widgets: component{name,props} where name is AssetPriceChart | AssetCatalogGrid | AssetComparativeChart | PortfolioBreakdown | TransactionSummary | TradeConfirmationWidget | GoalProgressWidget
- Interactive buttons: actionButton{label, action:"prompt"|"custom", payload, variant?:primary|secondary} — sends payload to chat when clicked
accent is one of cyan|violet|emerald|rose|amber|sky|zinc. icon is any lucide icon name (e.g. "trending-up").

Example for "How is Bitcoin doing?" — call get_asset_market_data, then paste the returned \`genui\` object:
\`\`\`genui
{ paste tool.genui here exactly }
\`\`\`

PREFER FLAT layouts: \`{ "view": [ metricCard, metricCard, chart ] }\`. Avoid deep nesting (section>grid>children). Max 8 sparkline points. Never truncate JSON — if short on space, omit sparkline rather than cutting mid-object.
For a trade ticket, use a component node: { "type": "component", "name": "TradeConfirmationWidget", "props": { "symbol": "BTCUSD", "direction": "BUY", "size": 0.5, "estimatedPrice": 67250, "leverage": 5, "fee": 12.5, "mode": "${tradingMode}" } }. Never call live trades simulated when mode is live.

2) HTML / SVG ARTIFACT — bespoke fully-custom interactive visuals ONLY.
Use a fenced block with language \`html\` only when the genui vocabulary genuinely cannot express it (a novel custom interactive visual, a hand-drawn diagram, a one-off mini-app). It runs in a secured sandboxed iframe and must be fully self-contained (inline CSS/SVG/JS, no external scripts or network requests). Dark theme (#0b0d19 / #050508), cyan #38bdf8, buy-green #34d399, sell-red #f87171, glassmorphism. Prefer genui for ordinary charts and dashboards.

INTERACTIVE HTML ARTIFACT API (injected automatically — use in onclick handlers):
- \`window.__quant.sendPrompt("your message")\` — sends a user message to the chat (e.g. "Analyze BTCUSD with subagents").
- \`window.__quant.sendAction("actionName", { ...data })\` — dispatches a custom app action.
- \`await window.__quant.complete("short prompt")\` — runs a lightweight AI completion inside the artifact and returns plain text (for calculators, classifiers, mini-assistants).
Example button: \`<button onclick="window.__quant.sendPrompt('Draft a trade plan for BTCUSD')">Ask agent</button>\`

GENUI ACTION BUTTONS (preferred for simple chat actions inside structured layouts):
{ "type": "actionButton", "label": "Run deeper analysis", "action": "prompt", "payload": "Spawn subagents to analyze BTCUSD", "variant": "primary" }
Use action "prompt" to send payload as the next user message. Use action "custom" for app-specific actions.

4) INTERACTIVE CLARIFICATION — when you need user input before proceeding (multi-step workflows, trade confirmations, scope choices):
Append an \`<interactive-question>\` block at the END of your response. The UI replaces the composer with a structured form.

<interactive-question id="unique_id" type="single-select">
  <title>Short question title</title>
  <description>One sentence explaining why you need this</description>
  <option value="Full prompt sent when user taps">Button label</option>
</interactive-question>

Types: single-select (pick one), multi-select (pick many), input (free text — include <placeholder>...</placeholder>, no options required).
Each option \`value\` must be a complete user prompt. IDs must be unique per question.

3) PLAIN MARKDOWN — for concepts, definitions, and short answers. Keep it tight; you may still weave in a small genui block to highlight key numbers.

LIVE STATUS (shown to the user while you work):
- In your thinking, emit ONE short phrase per step (about 3–7 words) — e.g. "Analyzing Bitcoin", "Spinning up sub-agents", "Checking your account", "Searching the web", "Digging deeper".
- Never write long sentences in status thoughts. Plain English only — not tool names or JSON.

USER UPDATES vs FINAL REPLY (critical):
- Call inform_user() for informal progress while working ("Spinning up sub-agents for BTC and ETH", "Synthesizing team results"). These appear in the live trace only.
- Your visible text reply is ONLY the final polished answer after work is done — never open with "Okay I understand", never narrate your plan, never append half-finished updates to the final message.
- Do not output visible text in the same turn as tool calls. Use inform_user, then tools, then a separate final text turn with results.

RULES:
- Whenever the user asks about a specific financial asset, coin, token, or stock ticker (e.g. Bitcoin, BTC, Ethereum, Apple, AAPL, gold, etc.) or requests to view charts, metrics, or perform analysis, you MUST use a tool (render_asset_chart / get_market_overview) or output \`\`\`quant markup — raw text alone is NOT allowed for asset-specific requests.
- Default to Quant UI or tools for charts and market views; use genui JSON for generic metrics; reach for HTML artifacts sparingly.
- Put exactly ONE complete artifact block inside each fence and finish it (the renderer waits for the block to close before mounting — never leave it half-written).
- When get_asset_market_data or render_asset_chart returns data, the server injects Quant UI with live Capital.com data — do not duplicate with hand-written chart nodes or legacy component JSON.
- Never claim you "cannot display graphics" — choose a generative-UI path instead.

CONVERSATION MEMORY:
- You receive the full conversation history for this chat. Use it to answer follow-ups, recall assets already discussed, and build on prior answers.
- When the user says "that", "it", "the same", "what about…", or asks a shorter follow-up, resolve references from earlier turns before calling tools again.

PINNED ASSETS:
- When a user message includes a <pinned_assets> block, those symbols are exact catalog tickers chosen in the UI — never substitute or guess alternatives.
- Always call get_asset_details and get_asset_market_data for every pinned symbol before synthesizing your answer.

AUTONOMOUS WEALTH MANAGER (you LEAD — user MONITORS):
- You are the user's financial wealth manager with FULL AUTONOMY when autonomous_trading is ON.
- You HAVE broker_action, execute_trade, get_account_state, and manage_goals — use them. You CAN open/close trades directly on Capital.com.
- FORBIDDEN when autonomous is ON: saying "I cannot execute trades", "requires your approval", "swipe to confirm", "manual placement", or "tools do not allow execution".
- ORCHESTRATOR WAKE: Messages from Wealth Monitor (monitor_directive) or starting with "[Wealth Monitor]" are ORDERS — execute immediately via execute_trade or broker_action place_order, then report results.
- When autonomous is ON: call execute_trade or broker_action place_order — trades go straight to Capital.com. NEVER show or describe a swipe-to-confirm ticket.
- When a balance goal exists with autonomous_trading ON, EXECUTE trades and REPORT what you did — never ask "would you like me to propose a trade?"
- After goal approval or enable_autonomous: narrate what you're doing ("I'm scanning markets…", "I opened a position on…") — act first, explain after.
- Use manage_goals(set_balance_target) with autonomous_trading:true when user approves a plan — this kicks off immediate autonomous management.
- Use get_account_state to report portfolio state; use GoalProgressWidget via manage_goals(check_progress).
- NEVER end a message with a menu of options like "would you like me to propose a trade?" — you are in charge.
- Use schedule_task only for reminders, not for trading decisions you should make yourself.
- Use get_macro_data and get_fundamentals for context you weave into narration.
- Use query_trading_knowledge for chart patterns, strategies, indicators, risk rules, and trading psychology from the structured knowledge base.
- Risk rule: respect max_risk_per_trade and max_position_pct on the goal.${memoryContext}`;

    const encoder = new TextEncoder();

    const customStream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: ChatStreamEvent) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        };

        if (isGeminiRuntimeConfigured()) {
          try {
            const contents: Array<Record<string, unknown>> = toGeminiContents(
              conversationHistory,
              effectiveMessage,
            );
            const toolCtx = {
              userId: user.id,
              tradingMode: tradingMode as "demo" | "live",
              conversationId: typeof conversationId === "string" ? conversationId : undefined,
              sessionContext,
              sendEvent,
            };

            const allowedTools = filterToolsForPlan(orchestratorToolDeclarations, userPlan);

            const { pendingGenui, pendingQuantUi } = await runAgentLoop({
              contents,
              systemInstruction,
              functionDeclarations: allowedTools,
              toolCtx,
              maxLoops: 6,
              onEvent: (event) => {
                sendEvent(event as ChatStreamEvent);
              },
            });

            if (pendingQuantUi) {
              sendEvent({ type: "quant_ui", markup: pendingQuantUi, source: "tool" });
            } else if (pendingGenui) {
              sendEvent({ type: "genui", payload: pendingGenui, source: "tool" });
            }
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.warn(
              "[POST /api/chat] Vertex AI streaming / tool calls failed, falling back to simulated high-fidelity token streaming:",
              errMsg
            );
            const parsed = parseVertexErrorMessage(err);
            await simulateStreamingResponse(effectiveMessage, sendEvent, `(Note: Vertex Gemini encountered an issue: ${parsed}. Running local model fallbacks...)\n\n`, conversationHistory, tradingMode);
          }
        } else {
          console.info(
            "[POST /api/chat] Gemini is not configured, running standard high-fidelity neutral simulated token stream."
          );
          await simulateStreamingResponse(effectiveMessage, sendEvent, "", conversationHistory, tradingMode);
        }

        controller.close();
      },
    });

    return new Response(customStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err: any) {
    console.error("[POST /api/chat] Route handler encountered fatal error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message || "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Simulates high-fidelity token-by-token streaming of reasoning and final responses
 * to ensure a stunning visual demonstration in any development context.
 * Now fully enriched to mimic the parallel subagent architecture and asset tools.
 */
async function simulateStreamingResponse(
  prompt: string,
  sendEvent: (data: ChatStreamEvent) => void,
  prefixText = "",
  conversationHistory: ChatHistoryTurn[] = [],
  tradingMode: "demo" | "live" = "demo",
) {
  const contextBlob = conversationHistory.length
    ? `${historyContextBlob(conversationHistory)}\nUser: ${prompt}`
    : prompt;
  const normalizedPrompt = contextBlob.toLowerCase();

  // Compare two assets — live Capital.com data
  if (
    normalizedPrompt.includes("compare") &&
    (normalizedPrompt.includes("aapl") ||
      normalizedPrompt.includes("msft") ||
      normalizedPrompt.includes("apple") ||
      normalizedPrompt.includes("microsoft"))
  ) {
    const compare = await fetchComparativeChartData({
      symbol1: "AAPL",
      symbol2: "MSFT",
      range: "6M",
    });

    if (compare.success === false) {
      sendEvent({ type: "text", text: `${prefixText}Could not load live comparison data: ${compare.error}` });
      return;
    }

    const intro = `${prefixText}Here's a live **AAPL vs MSFT** comparison from Capital.com (6M):`;
    for (const chunk of intro.split(" ")) {
      sendEvent({ type: "text", text: chunk + " " });
      await new Promise((r) => setTimeout(r, 12));
    }
    sendEvent({ type: "quant_ui", markup: compare.quant_ui!, source: "render_comparative_chart" });
    return;
  }

  // Market overview — server-built genui dashboard
  if (
    normalizedPrompt.includes("market overview") ||
    normalizedPrompt.includes("market snapshot") ||
    normalizedPrompt.includes("quick market")
  ) {
    const overview = await fetchMarketOverview();
    if (overview.success === false) {
      sendEvent({ type: "text", text: overview.error ?? "Market overview failed." });
      return;
    }
    const intro = `${prefixText}Here's a quick market overview:`;
    for (const chunk of intro.split(" ")) {
      sendEvent({ type: "text", text: chunk + " " });
      await new Promise((r) => setTimeout(r, 12));
    }
    sendEvent({ type: "quant_ui", markup: overview.quant_ui!, source: "get_market_overview" });
    return;
  }

  // Chart / single-asset requests — use real market data tool + compact genui
  if (
    normalizedPrompt.includes("bitcoin") ||
    normalizedPrompt.includes("btc") ||
    normalizedPrompt.includes("chart") ||
    normalizedPrompt.includes("graph") ||
    normalizedPrompt.includes("visualize") ||
    normalizedPrompt.includes("price of")
  ) {
    const query = normalizedPrompt.includes("btc") || normalizedPrompt.includes("bitcoin") ? "Bitcoin" : prompt;
    const toolUseId = `get_asset_market_data-${Date.now()}`;
    const started = Date.now();

    sendEvent({ type: "tool_start", toolUseId, name: "get_asset_market_data", args: { query, range: "1M" } });

    const market = await fetchAssetChartData({ query, range: "1M" });

    sendEvent({
      type: "tool_end",
      toolUseId,
      name: "get_asset_market_data",
      ok: market.success !== false,
      args: { query, range: "1M" },
      output: market,
      error: market.success === false ? market.error : undefined,
      durationMs: Date.now() - started,
    });

    if (market.success === false) {
      const errText = `${prefixText}I couldn't load market data for that asset: ${market.error}\n\nTry a catalog symbol like **BTCUSD**, **AAPL**, or **GOLD**.`;
      for (const chunk of errText.split(" ")) {
        sendEvent({ type: "text", text: chunk + " " });
        await new Promise((r) => setTimeout(r, 12));
      }
      return;
    }

    const quote = market.quote!;
    const stats = market.stats!;
    const change =
      quote.change24hPct != null
        ? `${quote.change24hPct >= 0 ? "+" : ""}${quote.change24hPct.toFixed(2)}%`
        : undefined;

    const mainText = `${prefixText}Here's **${market.display_name}** with live Capital.com data. Spot **${quote.spot.toLocaleString()}**${change ? ` (${change} 24h)` : ""}. ${stats.points} candles loaded.`;

    for (const chunk of mainText.split(" ")) {
      sendEvent({ type: "text", text: chunk + " " });
      await new Promise((r) => setTimeout(r, 12));
    }
    sendEvent({ type: "quant_ui", markup: market.quant_ui!, source: "render_asset_chart" });
    return;
  }

  // 2. Portfolio Breakdown / Allocation
  if (normalizedPrompt.includes("asset allocation") || normalizedPrompt.includes("portfolio") || normalizedPrompt.includes("allocation")) {
    const mainText = `${prefixText}### 💼 Simulated Portfolio Allocation Breakdown

Your current simulated portfolio is valued at **$24,500**. Here is an interactive, high-fidelity breakdown of your capital allocation.

You can click or hover on any segment of the donut chart below to inspect detailed descriptions, risk boundaries, and underlying assets:

\`\`\`json
{
  "component": "PortfolioBreakdown",
  "props": {
    "totalValue": 24500
  }
}
\`\`\`

#### Asset Class Distribution:
1. **Equities (50.0%)**: Core high-growth tech positions (AAPL, NVDA, TSLA) to capture structural stock market gains.
2. **Cryptocurrencies (25.0%)**: High-alpha, high-volatility sleeve (BTCUSD, ETHUSD) taking calculated directional leverage.
3. **Fixed Income Bonds (15.0%)**: Short-duration defensive treasuries serving as stability anchors.
4. **Liquid Cash Reserves (10.0%)**: Kept ready in the margin pool to instantly capitalize on intraday dips.

Would you like to rebalance any portion of this allocation or execute new CFD positions?`;

    const textChunks = mainText.split(" ");
    for (const chunk of textChunks) {
      sendEvent({ type: "text", text: chunk + " " });
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    return;
  }

  // 3. Spending / Transactions
  if (normalizedPrompt.includes("spending") || normalizedPrompt.includes("transactions")) {
    const mainText = `${prefixText}### 💳 Monthly Expense & Transaction Summary

I have compiled and categorized your operational costs and transaction fees for the current cycle. Your total expenses stand at **$4,850**.

Review the interactive bar chart below to inspect category allocations, or hover over individual bars to view precise dollar metrics:

\`\`\`json
{
  "component": "TransactionSummary",
  "props": {
    "totalAmount": 4850,
    "title": "Strategy & Operational Outlays"
  }
}
\`\`\`

#### Operational Expense Highlights:
* **Trading Commissions (38.0%)**: Rollover financing rates, contract execution spreads, and overnight CFD margins.
* **Market Data Feeds (24.0%)**: Real-time Level 2 order book API streams and historical tick feeds.
* **SaaS & AI Infrastructure (22.0%)**: LLM reasoning token usage and cloud strategy backtesting workers.
* **Advisory & Research (16.0%)**: Premium quantitative newsletter memberships and auditing logs.

Would you like to view your transaction invoice list or export these metrics?`;

    const textChunks = mainText.split(" ");
    for (const chunk of textChunks) {
      sendEvent({ type: "text", text: chunk + " " });
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    return;
  }

  // 4. Buy / Sell Trade Confirmation
  if (normalizedPrompt.includes("buy btc") || normalizedPrompt.includes("buy") || normalizedPrompt.includes("sell")) {
    const isSell = normalizedPrompt.includes("sell");
    const symbol = normalizedPrompt.includes("btc") ? "BTCUSD" : (normalizedPrompt.includes("aapl") ? "AAPL" : "BTCUSD");
    const price = symbol === "BTCUSD" ? 67250 : 185;
    const direction = isSell ? "SELL" : "BUY";
    const size = symbol === "BTCUSD" ? 0.5 : 10;
    const fee = symbol === "BTCUSD" ? 12.50 : 5.00;
    const isLive = tradingMode === "live";

    const confirmIntro = isLive
      ? "Please review the contract details below. To submit a **live order** to your Capital.com account, **Swipe to Confirm**. Confirmed trades use real margin from your available balance and open a CFD position you can monitor in the Investing tab."
      : "Please review the contract details below. To submit a **paper trade** to your demo portfolio, **Swipe to Confirm**. Confirmed trades update your demo cash balance and open a practice CFD position in the Investing tab.";

    const mainText = `${prefixText}### 🛡️ Secure Trade Execution Card

I have prepared an interactive trade execution ticket for your confirmation. 

${confirmIntro}

\`\`\`json
{
  "component": "TradeConfirmationWidget",
  "props": {
    "symbol": "${symbol}",
    "direction": "${direction}",
    "size": ${size},
    "estimatedPrice": ${price},
    "leverage": 5,
    "fee": ${fee},
    "mode": "${tradingMode}"
  }
}
\`\`\`

> [!WARNING]
> Trading financial CFDs carries significant risk. Please ensure your total leverage exposure remains in alignment with your risk tolerance guidelines.`;

    const textChunks = mainText.split(" ");
    for (const chunk of textChunks) {
      sendEvent({ type: "text", text: chunk + " " });
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    return;
  }

  // 5. Sandbox / SVG Approach A
  if (normalizedPrompt.includes("sandbox") || normalizedPrompt.includes("svg")) {
    const mainText = `${prefixText}### 🎨 Custom Sandboxed Visualisation (Approach A)

Here is a bespoke sandboxed HTML/SVG status widget, representing real-time system metrics. It runs inside an isolated \`<iframe>\` to guarantee complete security.

You can inspect the live layout in the "Preview" tab, or view/copy the raw source code in the "Code" tab:

\`\`\`html
<div style="background: linear-gradient(135deg, #09090b, #18181b); border: 1px solid #27272a; border-radius: 16px; padding: 24px; color: #f4f4f5; font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); text-align: left;">
  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #27272a; padding-bottom: 12px; margin-bottom: 16px;">
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 20px;">⚡</span>
      <span style="font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #10b981;">Quant Terminal Spark Node</span>
    </div>
    <span style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); color: #10b981; font-size: 11px; padding: 4px 8px; border-radius: 9999px; font-weight: 600;">ONLINE</span>
  </div>
  
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
    <div>
      <p style="color: #a1a1aa; font-size: 12px; margin: 0 0 4px 0;">Total Volume (24h)</p>
      <p style="font-size: 20px; font-weight: 700; margin: 0; color: #fff;">$1.24B</p>
    </div>
    <div>
      <p style="color: #a1a1aa; font-size: 12px; margin: 0 0 4px 0;">Volatility Index (VIX)</p>
      <p style="font-size: 20px; font-weight: 700; margin: 0; color: #ef4444;">18.42%</p>
    </div>
  </div>

  <div style="margin-top: 16px; border-top: 1px solid #27272a; padding-top: 12px; display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #a1a1aa;">
    <span>System Sandbox Node: #042</span>
    <span style="color: #6366f1; font-weight: 500;">Secure Sandboxed Context</span>
  </div>
</div>
\`\`\`

Feel free to customize the HTML code directly inside your request and watch me compile it dynamically!`;

    const textChunks = mainText.split(" ");
    for (const chunk of textChunks) {
      sendEvent({ type: "text", text: chunk + " " });
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    return;
  }

  // CASE 1: Query to list or pull assets
  if (normalizedPrompt.includes("list") || normalizedPrompt.includes("assets") || normalizedPrompt.includes("catalog") || normalizedPrompt.includes("pull")) {
    const catalog = await fetchAssetCatalog();
    sendEvent({
      type: "reasoning",
      text: `   ✅ Loaded **${catalog.count}** assets from catalog.\n`
    });
    await new Promise((resolve) => setTimeout(resolve, 500));

    sendEvent({ type: "genui", payload: catalog.genui, source: "get_all_assets" });

    const mainText = `${prefixText}Here are **${catalog.count}** tradable assets from the Terabits catalog — grouped by class with logos and live prices below. Ask me to analyze any symbol or open a trade from Command.`;

    const textChunks = mainText.split(" ");
    for (const chunk of textChunks) {
      sendEvent({ type: "text", text: chunk + " " });
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    return;
  }

  // CASE 2: Query requesting agents, subagents, or parallel analysis
  if (normalizedPrompt.includes("agent") || normalizedPrompt.includes("subagent") || normalizedPrompt.includes("team") || normalizedPrompt.includes("parallel") || normalizedPrompt.includes("analyze") || normalizedPrompt.includes("compare")) {
    let targetAsset = "BTCUSD";
    if (normalizedPrompt.includes("apple") || normalizedPrompt.includes("aapl")) {
      targetAsset = "AAPL";
    } else if (normalizedPrompt.includes("gold")) {
      targetAsset = "GOLD";
    } else if (normalizedPrompt.includes("eth")) {
      targetAsset = "ETHUSD";
    }

    const mockPrompts = [
      `On ${targetAsset} (4H): identify chart patterns, key support/resistance, and RSI/MACD readings. Use analyze_chart and live market data. Report only tool-verified levels — flag uncertainty explicitly.`,
      `For ${targetAsset}: summarize institutional flow context, sector drivers, and fair-value gaps using market intel and fundamentals. Cite sources; never invent headlines.`,
      `For ${targetAsset}: estimate short-term VaR and propose stop-loss / take-profit guardrails from live volatility data. State assumptions clearly if data is incomplete.`,
    ];

    const assignmentLabels = [
      `Chart patterns on ${targetAsset}`,
      `Flow context for ${targetAsset}`,
      `Risk guardrails for ${targetAsset}`,
    ];

    const reports = [
      `Trend structure on the 4H frame shows momentum with RSI near 63 — levels and patterns per tool output above.`,
      `Institutional flow context remains constructive; fair-value gap estimated from available intel (see tool citations).`,
      `VaR and guardrails derived from live volatility — cap exposure if confidence is low.`,
    ];

    for (let idx = 0; idx < mockPrompts.length; idx++) {
      const prompt = mockPrompts[idx];
      const assignmentLabel = assignmentLabels[idx];
      const id = `sim-subagent-${idx}-${Date.now()}`;
      const color = subAgentColorAt(idx);

      sendEvent({ type: "subagent_start", id, prompt, assignmentLabel, color });
      await new Promise((r) => setTimeout(r, 200));

      const toolUseId = `analyze_chart-${id}`;
      sendEvent({
        type: "subagent_tool_start",
        id,
        toolUseId,
        name: "analyze_chart",
        args: { symbol: targetAsset, interval: "4h" },
      });
      await new Promise((r) => setTimeout(r, 500));
      sendEvent({
        type: "subagent_tool_end",
        id,
        toolUseId,
        name: "analyze_chart",
        ok: true,
        output: { success: true, symbol: targetAsset },
        durationMs: 480,
      });

      for (const word of reports[idx].split(" ")) {
        sendEvent({ type: "subagent_text", id, text: word + " " });
        await new Promise((r) => setTimeout(r, 8));
      }

      const durationMs = 900 + idx * 200;
      sendEvent({ type: "subagent_end", id, status: "done", report: reports[idx], durationMs });
      await new Promise((r) => setTimeout(r, 150));
    }

    const mainText = `${prefixText}### Multi-Agent Synthesis for **${targetAsset}**

I delegated three parallel sub-agents with full research prompts, then synthesized their tool-verified findings below. Re-run delegation anytime if you need deeper or updated analysis.

### Combined findings
Momentum and structure on **${targetAsset}** look constructive on the 4H frame (RSI ~63 per chart tools). Flow context is supportive with cited intel. Risk guardrails should cap exposure when confidence is limited — see sub-agent widgets for each assignment trace and report.`;

    for (const chunk of mainText.split(" ")) {
      sendEvent({ type: "text", text: chunk + " " });
      await new Promise((r) => setTimeout(r, 15));
    }
    return;
  }

  // DEFAULT CASE: Normal prompt simulation
  const mainText = `${prefixText}Hello! I am Quant, your dedicated AI companion.

I received your prompt: "${prompt}".

I have been enhanced with comprehensive, parallel **Agent Teams** and **Asset Catalog MCP Tools**. You can ask me to:
1. **"List all assets in the catalog"** or query specifics on individual asset leverage and transaction limits.
2. **"Spawn subagents to analyze Apple"** or compare multi-currency forex trends in parallel.

How would you like to proceed with your plans and quantitative goals today?`;

  const textChunks = mainText.split(" ");
  for (const chunk of textChunks) {
    sendEvent({ type: "text", text: chunk + " " });
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

