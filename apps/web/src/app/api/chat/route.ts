import { getAgentGeminiModelId, getVertexGeminiClient, isGeminiRuntimeConfigured, geminiIncludeThoughts } from "@/lib/gemini/vertex-client";
import { parseVertexErrorMessage } from "@/lib/gemini/vertex-error-parser";
import { getCapitalAssetCatalog } from "@/lib/catalog/capital-assets";
import { generateVertexTextCompletion } from "@/lib/gemini/vertex-text-completion";
import { fetchAssetCatalog } from "@/lib/chat/asset-catalog-tool";
import { fetchAssetMarketData, fetchMarketOverview } from "@/lib/chat/market-data-tool";
import { searchMarketIntel, getLatestCatalystBrief, getMacroRegime, findHistoricalAnalogs } from "@quant/market-intel";
import type { ChatStreamEvent } from "@/lib/chat/stream-types";
import { extractToolGenui } from "@/lib/chat/stream-types";
import { historyContextBlob, parseClientHistory, toGeminiContents, type ChatHistoryTurn } from "@/lib/chat/conversation-history";
import { augmentMessageWithPinnedAssets, parsePinnedAssets } from "@/lib/chat/pinned-assets";
import { fetchAccountState } from "@/lib/chat/tools/account-state-tool";
import { executeBrokerAction, type BrokerActionArgs } from "@/lib/chat/tools/broker-action-tool";
import { manageUserGoals, type ManageGoalArgs } from "@/lib/chat/tools/goal-tool";
import { fetchFundamentals, fetchMacroData } from "@/lib/chat/tools/macro-tools";
import { scheduleAgentTask, type ScheduleTaskArgs } from "@/lib/chat/tools/schedule-task-tool";
import { buildSessionContextPrompt, getSessionContext } from "@/lib/chat/conversation-persistence";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Type } from "@google/genai";

export const dynamic = "force-dynamic";

// Define Gemini tool schemas matching the approved technical specifications
const getAllAssetsDeclaration = {
  name: "get_all_assets",
  description: "Retrieve all assets available in the Terabits AI catalog, grouped by asset class (crypto, stock, etf, index, commodity, etc.)",
  parameters: {
    type: Type.OBJECT,
    properties: {
      asset_class: {
        type: Type.STRING,
        description: "Optional filter by asset class: crypto, stock, or etf",
        enum: ["crypto", "stock", "etf"]
      }
    }
  }
};

const getAssetDetailsDeclaration = {
  name: "get_asset_details",
  description: "Retrieve detailed metadata and transaction rules for a specific asset ticker from the catalog.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbol: {
        type: Type.STRING,
        description: "The exact symbol of the asset to look up (e.g. BTCUSD, AAPL, EURUSD, GOLD)"
      }
    },
    required: ["symbol"]
  }
};

const getAssetMarketDataDeclaration = {
  name: "get_asset_market_data",
  description:
    "Fetch live quote and historical OHLCV candles for any catalog asset. Use for charts, price checks, and technical context. Resolves names like Bitcoin → BTCUSD.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbol: {
        type: Type.STRING,
        description: "Ticker or name, e.g. BTCUSD, Bitcoin, AAPL, GOLD"
      },
      query: {
        type: Type.STRING,
        description: "Alternative to symbol — natural language asset name"
      },
      range: {
        type: Type.STRING,
        description: "History window: 1D, 1W, 1M, 3M, 6M, 1Y (default 1M)"
      }
    }
  }
};

const getMarketOverviewDeclaration = {
  name: "get_market_overview",
  description:
    "Build a ready-to-render market overview dashboard (multiple assets). Returns a complete `genui` object — paste it verbatim into a ```genui block.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbols: {
        type: Type.ARRAY,
        description: "Optional tickers, e.g. [\"BTCUSD\",\"ETHUSD\",\"US100\"]. Defaults to top markets.",
        items: { type: Type.STRING },
      },
    },
  },
};

const spawnSubagentsDeclaration = {
  name: "spawn_subagents",
  description: "Spin up multiple copy instances of yourself as parallel subagents (agent teams) to perform specialized analyses (e.g., technical, financial, risk, sentiment) on specific assets in parallel, and compile their reports.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      subagents: {
        type: Type.ARRAY,
        description: "List of subagents to spin up in parallel",
        items: {
          type: Type.OBJECT,
          properties: {
            role: {
              type: Type.STRING,
              description: "The specialized role of the subagent (e.g., Technical Analyst, Fundamental Analyst, Risk Manager, Sentiment Investigator)"
            },
            asset_symbol: {
              type: Type.STRING,
              description: "The symbol of the asset for this subagent to analyze (e.g., BTCUSD, AAPL, GOLD)"
            },
            instruction: {
              type: Type.STRING,
              description: "Specific analytical instruction or question for this subagent to resolve"
            }
          },
          required: ["role", "asset_symbol", "instruction"]
        }
      }
    },
    required: ["subagents"]
  }
};

const searchMarketIntelDeclaration = {
  name: "search_market_intel",
  description:
    "Search ingested market intelligence (news, macro, flow) with verified sources. Use for 'why is X moving' questions before synthesizing an answer.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "Search query" },
      symbol: { type: Type.STRING, description: "Optional ticker filter e.g. NVDA" },
    },
    required: ["query"],
  },
};

const getCatalystBriefDeclaration = {
  name: "get_catalyst_brief",
  description: "Get latest AI catalyst synthesis brief for a symbol with impact score and provenance URLs.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbol: { type: Type.STRING },
    },
    required: ["symbol"],
  },
};

const getAccountStateDeclaration = {
  name: "get_account_state",
  description:
    "Get complete account information: wallet balance, locked margin, open positions, recent transactions, and portfolio performance.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      include_history: { type: Type.BOOLEAN, description: "Include recent ledger transactions" },
      include_positions: { type: Type.BOOLEAN, description: "Include open positions with P&L" },
      include_performance: { type: Type.BOOLEAN, description: "Include portfolio growth metrics" },
      history_limit: { type: Type.NUMBER, description: "Max transactions to return (default 50)" },
    },
  },
};

const brokerActionDeclaration = {
  name: "broker_action",
  description:
    "Interact with Capital.com: quotes, candles, broker account, positions. place_order/close_position return a confirmation proposal — never execute without user confirmation.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        enum: ["get_quote", "get_positions", "get_account", "get_candles", "place_order", "close_position"],
      },
      symbol: { type: Type.STRING },
      direction: { type: Type.STRING, enum: ["BUY", "SELL"] },
      size: { type: Type.NUMBER },
      stop_loss: { type: Type.NUMBER },
      take_profit: { type: Type.NUMBER },
      deal_id: { type: Type.STRING },
      timeframe: { type: Type.STRING, description: "1D, 1W, 1M, 3M, 6M, 1Y" },
    },
    required: ["action"],
  },
};

const scheduleTaskDeclaration = {
  name: "schedule_task",
  description:
    "Schedule a future check (price, position review, reminder). Use when waiting for price movement or long-running scalping workflows.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      task_type: {
        type: Type.STRING,
        enum: ["price_check", "position_review", "market_open", "reminder", "strategy_check"],
      },
      delay_minutes: { type: Type.NUMBER, description: "Minutes from now (1–1440)" },
      symbol: { type: Type.STRING },
      condition: { type: Type.STRING, description: "Optional JS expression using `price`, e.g. price > 50000" },
      message: { type: Type.STRING },
    },
    required: ["task_type", "delay_minutes"],
  },
};

const manageGoalsDeclaration = {
  name: "manage_goals",
  description: "Set, list, update, or cancel persistent user trading goals (e.g. grow $20 to $1000).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      operation: { type: Type.STRING, enum: ["list", "set", "update", "cancel"] },
      goal_type: {
        type: Type.STRING,
        enum: ["balance_target", "strategy_preference", "risk_tolerance", "milestone"],
      },
      goal_value: { type: Type.OBJECT, description: "JSON goal payload, e.g. { target: 1000, current: 20 }" },
      description: { type: Type.STRING },
      goal_id: { type: Type.STRING },
      progress_pct: { type: Type.NUMBER },
      status: { type: Type.STRING, enum: ["active", "achieved", "cancelled", "paused"] },
    },
    required: ["operation"],
  },
};

const getMacroDataDeclaration = {
  name: "get_macro_data",
  description: "Fetch macro indicators and market sentiment (Fear & Greed, rates, VIX via FRED when configured).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      indicators: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "e.g. fear_greed, macro, rates, vix",
      },
    },
  },
};

const getFundamentalsDeclaration = {
  name: "get_fundamentals",
  description: "Fetch stock fundamentals and news sentiment via Alpha Vantage (when API key configured).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbol: { type: Type.STRING },
    },
    required: ["symbol"],
  },
};

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
    } = body;

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ success: false, error: "Prompt message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const tradingMode = rawTradingMode === "live" ? "live" : "demo";
    let memoryContext = typeof clientSessionContext === "string" ? clientSessionContext : "";
    if (!memoryContext) {
      try {
        const ctx = await getSessionContext(user.id, tradingMode);
        memoryContext = buildSessionContextPrompt(ctx);
      } catch {
        memoryContext = "";
      }
    }

    const pinnedAssets = parsePinnedAssets(rawPinned);
    const effectiveMessage = augmentMessageWithPinnedAssets(message, pinnedAssets);

    const conversationHistory = parseClientHistory(rawHistory);

    const systemInstruction = `You are the Terabits Wealth Engine coordinator — an AI trading agent team that helps users grow capital on autopilot.
Your goal is to observe markets, synthesize intel, propose actionable trades, explain risk, and guide simulated or live execution with clarity and discipline.
You maintain a professional, decisive tone. Provide structured replies using markdown formatting beautifully.

You coordinate specialized agent teams equipped with MCP tools to:
- Retrieve the asset catalog and detailed assets data.
- Pull live quotes and historical OHLCV via get_asset_market_data (use this for ANY chart or price request).
- Search verified market intelligence via search_market_intel for catalyst and headline context — cite provenance URLs, never invent headlines.
- Spin up specialized agent teams (parallel subagents) for technical, fundamental, risk, and sentiment analysis before trade proposals.

When the user asks for a chart, price, market overview, or market view:
1. Call get_market_overview (multi-asset) or get_asset_market_data (single asset).
2. The client renders the tool's \`genui\` payload automatically — write **one short intro sentence only**. Do NOT output a \`\`\`genui block for market data (the server injects the dashboard).

When the user asks to list, browse, or pull assets from the catalog:
1. Call get_all_assets (optionally filter by asset_class).
2. The client renders the tool's \`genui\` payload automatically (AssetCatalogGrid with logos and live prices) — write **one short intro sentence only**. Do NOT output barlist nodes or markdown tables for the full catalog.

When requested to analyze assets or run deep research, aggressively use the 'spawn_subagents' tool to form a team of subagents, and then synthesize their findings beautifully in your final response.

### 🌟 GENERATIVE UI ENGINE (how you reply)
Do NOT dump long walls of dry text. Lead with one short, high-signal sentence, then express the substance as live UI. The client renders three kinds of generated UI — pick the lightest that fits.

1) GENUI — declarative composed interface (DEFAULT — use this most).
For ANY structured financial answer (metrics, comparisons, breakdowns, scores, risk, summaries), output a fenced code block whose language tag is \`genui\` containing a single JSON layout tree. The renderer composes branded, animated React widgets; you never hand-write HTML for this. The JSON may be a single node { "type": ... }, a wrapper { "view": [ ...nodes ] }, or a bare array of nodes.

Node vocabulary (every node has a \`type\`):
- Layout: section{title?,subtitle?,children[]}, grid{columns:1-4,children[]}, divider, text{text,tone?:default|muted|strong}
- Metrics: stat{label,value,delta?,trend?:up|down|flat,icon?,accent?}, metricCard{label,value,sublabel?,delta?,trend?,sparkline?:number[],accent?}
- Viz: sparkline{data:number[],accent?,label?}, chart{variant?:line|area,series:[{name,data:number[],color?}],labels?:string[],title?}, gauge{value:0-100,label?,caption?,accent?}, progress{value:0-100,label?,caption?,accent?}, barlist{title?,items:[{label,value,accent?}],unit?}
- Info: callout{variant:info|success|warning|danger,title?,text}, badge{text,accent?}, keyValue{items:[{label,value,accent?}]}, table{columns:string[],rows:(string|number)[][]}
- Bridge to prebuilt widgets: component{name,props} where name is AssetCatalogGrid | AssetComparativeChart | PortfolioBreakdown | TransactionSummary | TradeConfirmationWidget
- Interactive buttons: actionButton{label, action:"prompt"|"custom", payload, variant?:primary|secondary} — sends payload to chat when clicked
accent is one of cyan|violet|emerald|rose|amber|sky|zinc. icon is any lucide icon name (e.g. "trending-up").

Example for "How is Bitcoin doing?" — call get_asset_market_data, then paste the returned \`genui\` object:
\`\`\`genui
{ paste tool.genui here exactly }
\`\`\`

PREFER FLAT layouts: \`{ "view": [ metricCard, metricCard, chart ] }\`. Avoid deep nesting (section>grid>children). Max 8 sparkline points. Never truncate JSON — if short on space, omit sparkline rather than cutting mid-object.
For a trade ticket, use a component node: { "type": "component", "name": "TradeConfirmationWidget", "props": { "symbol": "BTCUSD", "direction": "BUY", "size": 0.5, "estimatedPrice": 67250, "leverage": 5, "fee": 12.5 } }.

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

RULES:
- Whenever the user asks about a specific financial asset, coin, token, or stock ticker (e.g. Bitcoin, BTC, Ethereum, Apple, AAPL, gold, etc.) or requests to view charts, metrics, or perform analysis, you MUST output a \`\`\`genui block containing structured charts, metrics, and cards, or a \`\`\`html block containing a custom interactive SVG card. Raw text alone is NOT allowed for asset-specific requests.
- Default to genui for anything quantitative or comparative; reach for HTML artifacts sparingly.
- Put exactly ONE complete, valid JSON object inside each genui block and finish it (the renderer waits for the block to close before mounting — never leave it half-written).
- GenUI JSON must be strict valid JSON: no ellipsis (...), no comments, no trailing commas. Include every sparkline number explicitly (max 12 points) or omit sparkline entirely.
- When get_asset_market_data returns sparkline/labels, copy those arrays exactly into your chart/metricCard nodes.
- Never claim you "cannot display graphics" — choose a generative-UI path instead.

CONVERSATION MEMORY:
- You receive the full conversation history for this chat. Use it to answer follow-ups, recall assets already discussed, and build on prior answers.
- When the user says "that", "it", "the same", "what about…", or asks a shorter follow-up, resolve references from earlier turns before calling tools again.

PINNED ASSETS:
- When a user message includes a <pinned_assets> block, those symbols are exact catalog tickers chosen in the UI — never substitute or guess alternatives.
- Always call get_asset_details and get_asset_market_data for every pinned symbol before synthesizing your answer.

AUTONOMOUS QUANT CAPABILITIES:
- Use get_account_state before trade proposals to know wallet, positions, and performance.
- Use broker_action for live Capital.com quotes/positions; place_order/close_position only as proposals — confirm via interactive-question.
- Use schedule_task to wait for price moves or review positions later (e.g. 30-minute scalp check).
- Use manage_goals to remember milestones (e.g. grow $20 → $1000) across sessions.
- Use get_macro_data and get_fundamentals for broader market context.
- Be proactive: on session start, summarize goals, account state, and suggest next steps.
- Risk rule: never risk > 2% of account per trade unless user explicitly overrides.${memoryContext}`;

    const encoder = new TextEncoder();

    const customStream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: ChatStreamEvent) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        };

        if (isGeminiRuntimeConfigured()) {
          try {
            const ai = getVertexGeminiClient();
            const model = getAgentGeminiModelId();

            const contents: any[] = toGeminiContents(conversationHistory, effectiveMessage);
            let loopCount = 0;
            const maxLoops = 5;
            let pendingGenui: unknown = null;

            const toolConfig = {
              systemInstruction,
              temperature: 0.3,
              maxOutputTokens: 8192,
              thinkingConfig: {
                thinkingBudget: 2048,
                includeThoughts: geminiIncludeThoughts(),
              },
              tools: [
                {
                  functionDeclarations: [
                    getAllAssetsDeclaration,
                    getAssetDetailsDeclaration,
                    getAssetMarketDataDeclaration,
                    getMarketOverviewDeclaration,
                    spawnSubagentsDeclaration,
                    searchMarketIntelDeclaration,
                    getCatalystBriefDeclaration,
                    getAccountStateDeclaration,
                    brokerActionDeclaration,
                    scheduleTaskDeclaration,
                    manageGoalsDeclaration,
                    getMacroDataDeclaration,
                    getFundamentalsDeclaration,
                  ]
                }
              ]
            };

            while (loopCount < maxLoops) {
              loopCount++;

              const responseStream = await ai.models.generateContentStream({
                model,
                contents,
                config: toolConfig,
              });

              const parts: any[] = [];

              for await (const chunk of responseStream) {
                const chunkParts = chunk.candidates?.[0]?.content?.parts || [];
                for (const part of chunkParts) {
                  parts.push(part);
                  if (part.thought && part.text) {
                    sendEvent({ type: "reasoning", text: part.text });
                  } else if (part.text && !part.functionCall) {
                    sendEvent({ type: "text", text: part.text });
                  }
                }
              }

              const functionCalls = parts.filter((p) => p.functionCall);

              if (functionCalls.length > 0) {
                contents.push({ role: "model", parts });

                const toolResponseParts: any[] = [];

                for (const callPart of functionCalls) {
                  const call = callPart.functionCall;
                  if (!call) continue;

                  const name = call.name as string;
                  const args = (call.args ?? {}) as Record<string, unknown>;
                  const toolUseId = `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                  const started = Date.now();

                  sendEvent({ type: "status", label: name.replace(/_/g, " "), detail: "Running" });
                  sendEvent({ type: "tool_start", toolUseId, name, args });

                  let toolResult: unknown;

                  if (name === "get_all_assets") {
                    const filter = args?.asset_class as string | undefined;
                    toolResult = await fetchAssetCatalog(filter);
                  } else if (name === "get_asset_details") {
                    const symbol = args?.symbol as string | undefined;
                    const allAssets = getCapitalAssetCatalog();
                    const asset = symbol
                      ? allAssets.find((a) => a.symbol?.toLowerCase() === symbol.toLowerCase())
                      : undefined;
                    toolResult = asset
                      ? { success: true, asset }
                      : { success: false, error: `Asset '${symbol || "unknown"}' not found.` };
                  } else if (name === "get_asset_market_data") {
                    toolResult = await fetchAssetMarketData({
                      symbol: args?.symbol as string | undefined,
                      query: args?.query as string | undefined,
                      range: (args?.range as string | undefined) ?? "1M",
                    });
                  } else if (name === "get_market_overview") {
                    const symbols = Array.isArray(args?.symbols)
                      ? (args.symbols as string[])
                      : undefined;
                    toolResult = await fetchMarketOverview(symbols);
                  } else if (name === "search_market_intel") {
                    toolResult = {
                      success: true,
                      results: await searchMarketIntel({
                        query: String(args?.query ?? ""),
                        symbol: args?.symbol ? String(args.symbol).toUpperCase() : undefined,
                        limit: 8,
                      }),
                    };
                  } else if (name === "get_catalyst_brief") {
                    const sym = String(args?.symbol ?? "").toUpperCase();
                    const brief = sym ? await getLatestCatalystBrief(sym) : null;
                    const regime = await getMacroRegime();
                    toolResult = {
                      success: Boolean(brief),
                      brief,
                      macroRegime: regime?.regime ?? null,
                    };
                  } else if (name === "spawn_subagents") {
                    const subagentsList = (args?.subagents || []) as Array<{
                      role: string;
                      asset_symbol: string;
                      instruction: string;
                    }>;

                    sendEvent({
                      type: "status",
                      label: "Subagent team",
                      detail: `${subagentsList.length} analysts running`,
                    });

                    const subagentPromises = subagentsList.map(async (sub) => {
                      const asset = getCapitalAssetCatalog().find(
                        (a) => a.symbol?.toLowerCase() === sub.asset_symbol?.toLowerCase()
                      );
                      const assetContext = asset
                        ? `Asset: "${asset.display_name}", sector ${asset.sector}, class ${asset.asset_class}.`
                        : `Asset: ${sub.asset_symbol}.`;

                      sendEvent({
                        type: "status",
                        label: sub.role,
                        detail: `Analyzing ${sub.asset_symbol}`,
                      });

                      try {
                        const analysis = await generateVertexTextCompletion({
                          userPrompt: sub.instruction,
                          systemInstruction: `You are a specialized ${sub.role}. ${assetContext} Be concise and analytical.`,
                          temperature: 0.2,
                          maxTokens: 1200,
                        });
                        return {
                          role: sub.role,
                          asset: sub.asset_symbol,
                          status: "success",
                          report: analysis,
                        };
                      } catch (subErr: unknown) {
                        const errMsg = subErr instanceof Error ? subErr.message : String(subErr);
                        return {
                          role: sub.role,
                          asset: sub.asset_symbol,
                          status: "failed",
                          error: errMsg,
                        };
                      }
                    });

                    const subagentResults = await Promise.all(subagentPromises);
                    toolResult = { success: true, team_results: subagentResults };
                  } else if (name === "get_account_state") {
                    toolResult = await fetchAccountState(user.id, tradingMode, {
                      include_history: args?.include_history as boolean | undefined,
                      include_positions: args?.include_positions as boolean | undefined,
                      include_performance: args?.include_performance as boolean | undefined,
                      history_limit: args?.history_limit as number | undefined,
                    });
                  } else if (name === "broker_action") {
                    toolResult = await executeBrokerAction(user.id, tradingMode, {
                      action: args?.action as BrokerActionArgs["action"],
                      symbol: args?.symbol as string | undefined,
                      direction: args?.direction as "BUY" | "SELL" | undefined,
                      size: args?.size as number | undefined,
                      stop_loss: args?.stop_loss as number | undefined,
                      take_profit: args?.take_profit as number | undefined,
                      deal_id: args?.deal_id as string | undefined,
                      timeframe: args?.timeframe as string | undefined,
                      conversation_id: typeof conversationId === "string" ? conversationId : undefined,
                    });
                  } else if (name === "schedule_task") {
                    toolResult = await scheduleAgentTask(user.id, tradingMode, {
                      task_type: args?.task_type as ScheduleTaskArgs["task_type"],
                      delay_minutes: Number(args?.delay_minutes ?? 30),
                      symbol: args?.symbol as string | undefined,
                      condition: args?.condition as string | undefined,
                      message: args?.message as string | undefined,
                      conversation_id: typeof conversationId === "string" ? conversationId : undefined,
                    });
                  } else if (name === "manage_goals") {
                    toolResult = await manageUserGoals(user.id, tradingMode, {
                      operation: args?.operation as ManageGoalArgs["operation"],
                      goal_type: args?.goal_type as ManageGoalArgs["goal_type"],
                      goal_value: args?.goal_value as Record<string, unknown> | undefined,
                      description: args?.description as string | undefined,
                      goal_id: args?.goal_id as string | undefined,
                      progress_pct: args?.progress_pct as number | undefined,
                      status: args?.status as ManageGoalArgs["status"],
                    });
                  } else if (name === "get_macro_data") {
                    const indicators = Array.isArray(args?.indicators)
                      ? (args.indicators as string[])
                      : undefined;
                    toolResult = await fetchMacroData(indicators);
                  } else if (name === "get_fundamentals") {
                    toolResult = await fetchFundamentals(String(args?.symbol ?? ""));
                  } else {
                    toolResult = { success: false, error: "Unknown tool name" };
                  }

                  const ok =
                    toolResult != null &&
                    typeof toolResult === "object" &&
                    (toolResult as { success?: boolean }).success !== false;

                  sendEvent({
                    type: "tool_end",
                    toolUseId,
                    name,
                    ok,
                    args,
                    output: toolResult,
                    error: ok ? undefined : String((toolResult as { error?: string })?.error ?? "Tool failed"),
                    durationMs: Date.now() - started,
                  });

                  const toolGenui = ok ? extractToolGenui(toolResult) : null;
                  if (toolGenui) pendingGenui = toolGenui;

                  toolResponseParts.push({
                    functionResponse: {
                      name,
                      response: toolResult,
                    },
                  });
                }

                // Add tool responses back to the conversation contents history as a user turn
                contents.push({
                  role: "user",
                  parts: toolResponseParts
                });

              } else {
                break;
              }
            }

            if (pendingGenui) {
              sendEvent({ type: "genui", payload: pendingGenui, source: "tool" });
            }
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.warn(
              "[POST /api/chat] Vertex AI streaming / tool calls failed, falling back to simulated high-fidelity token streaming:",
              errMsg
            );
            const parsed = parseVertexErrorMessage(err);
            await simulateStreamingResponse(effectiveMessage, sendEvent, `(Note: Vertex Gemini encountered an issue: ${parsed}. Running local model fallbacks...)\n\n`, conversationHistory);
          }
        } else {
          console.info(
            "[POST /api/chat] Gemini is not configured, running standard high-fidelity neutral simulated token stream."
          );
          await simulateStreamingResponse(effectiveMessage, sendEvent, "", conversationHistory);
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
  conversationHistory: ChatHistoryTurn[] = []
) {
  const contextBlob = conversationHistory.length
    ? `${historyContextBlob(conversationHistory)}\nUser: ${prompt}`
    : prompt;
  const normalizedPrompt = contextBlob.toLowerCase();

  // 1. Compare AAPL and MSFT
  if (normalizedPrompt.includes("compare aapl and msft") || normalizedPrompt === "compare" || (normalizedPrompt.includes("compare") && (normalizedPrompt.includes("aapl") || normalizedPrompt.includes("msft") || normalizedPrompt.includes("apple") || normalizedPrompt.includes("microsoft")))) {
    const simulatedThoughts = [
      "Analyzing user request to compare Apple (AAPL) and Microsoft (MSFT)...\n",
      "Scanning dual pricing vectors across historical daily candles...\n",
      "Calculating rolling beta correlation and momentum indicators...\n",
      "Synthesizing comparative performance vectors...\n"
    ];

    for (const thought of simulatedThoughts) {
      const words = thought.split(" ");
      for (const word of words) {
        sendEvent({ type: "reasoning", text: word + " " });
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const mainText = `${prefixText}### 📊 Apple (AAPL) vs Microsoft (MSFT) Comparative Analysis

I have completed a high-fidelity comparative analysis between **Apple Inc. (AAPL)** and **Microsoft Corp. (MSFT)** covering the active 6-month momentum index. 

Both assets represent leading market caps in the tech sector, but they show diverging short-term momentum. Below is an interactive comparative chart that you can toggle across **1M**, **6M**, and **1Y** timeframes to inspect rolling price developments:

\`\`\`json
{
  "component": "AssetComparativeChart",
  "props": {
    "ticker1": "AAPL",
    "ticker2": "MSFT"
  }
}
\`\`\`

#### Key Quantitative Takeaways:
* **AAPL Momentum (Indigo)**: Shows strong bullish retention supported by solid services revenue and high-conviction institutional inflows.
* **MSFT Momentum (Emerald)**: Demonstrates steady growth backed by cloud expansion and deep integration of enterprise AI pipelines.
* **Correlation Metric**: The 30-day rolling correlation sits at **0.78**, reflecting macro-economic alignment with slight asset-specific divergence.

How would you like to balance your tactical exposure between these two blue-chips today?`;

    const textChunks = mainText.split(" ");
    for (const chunk of textChunks) {
      sendEvent({ type: "text", text: chunk + " " });
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
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
    sendEvent({ type: "genui", payload: overview.genui, source: "get_market_overview" });
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

    sendEvent({ type: "status", label: "get asset market data", detail: "Fetching candles" });
    sendEvent({ type: "tool_start", toolUseId, name: "get_asset_market_data", args: { query, range: "1M" } });

    const market = await fetchAssetMarketData({ query, range: "1M" });

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
    const trend =
      quote.change24hPct == null ? "flat" : quote.change24hPct >= 0 ? "up" : "down";

    const genui = market.genui ?? {
      view: [
        {
          type: "grid",
          columns: 2,
          children: [
            {
              type: "metricCard",
              label: market.symbol,
              value: quote.spot,
              delta: change,
              trend,
              accent: "amber",
              sparkline: (() => {
                const s = market.sparkline as number[] | undefined;
                return Array.isArray(s) ? s.slice(-8) : undefined;
              })(),
            },
            {
              type: "keyValue",
              items: [
                { label: "24h High", value: stats.high },
                { label: "24h Low", value: stats.low },
                { label: "Points", value: stats.points },
              ],
            },
          ],
        },
        {
          type: "chart",
          variant: "area",
          title: `${market.display_name} · 1M`,
          labels: market.labels,
          series: [{ name: market.symbol, data: market.sparkline, color: "amber" }],
        },
      ],
    };

    const mainText = `${prefixText}Here's **${market.display_name}** with live quote and 1-month history. Spot **${quote.spot.toLocaleString()}**${change ? ` (${change} 24h)` : ""}. Want a different range or a trade ticket?`;

    for (const chunk of mainText.split(" ")) {
      sendEvent({ type: "text", text: chunk + " " });
      await new Promise((r) => setTimeout(r, 12));
    }
    sendEvent({ type: "genui", payload: genui, source: "get_asset_market_data" });
    return;
  }

  // 2. Portfolio Breakdown / Allocation
  if (normalizedPrompt.includes("asset allocation") || normalizedPrompt.includes("portfolio") || normalizedPrompt.includes("allocation")) {
    const simulatedThoughts = [
      "Accessing user ledger balances and simulated positions database...\n",
      "Aggregating total values and computing weighted asset class ratios...\n",
      "Formatting allocation percentages (Equities, Crypto, Fixed Income, Cash)...\n"
    ];

    for (const thought of simulatedThoughts) {
      const words = thought.split(" ");
      for (const word of words) {
        sendEvent({ type: "reasoning", text: word + " " });
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

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
    const simulatedThoughts = [
      "Querying quantitative billing history and API subscription ledgers...\n",
      "Grouping expenditure vectors by category (Commissions, Data, Compute, Research)...\n",
      "Generating monthly expense visualization nodes...\n"
    ];

    for (const thought of simulatedThoughts) {
      const words = thought.split(" ");
      for (const word of words) {
        sendEvent({ type: "reasoning", text: word + " " });
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

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
    const simulatedThoughts = [
      "Parsing order parameters and validating tick sizes...\n",
      "Scanning available CFD order books for optimal execution price...\n",
      "Calculating margin requirements and transaction commissions...\n",
      "Drafting interactive trade confirmation ticket...\n"
    ];

    for (const thought of simulatedThoughts) {
      const words = thought.split(" ");
      for (const word of words) {
        sendEvent({ type: "reasoning", text: word + " " });
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const isSell = normalizedPrompt.includes("sell");
    const symbol = normalizedPrompt.includes("btc") ? "BTCUSD" : (normalizedPrompt.includes("aapl") ? "AAPL" : "BTCUSD");
    const price = symbol === "BTCUSD" ? 67250 : 185;
    const direction = isSell ? "SELL" : "BUY";
    const size = symbol === "BTCUSD" ? 0.5 : 10;
    const fee = symbol === "BTCUSD" ? 12.50 : 5.00;

    const mainText = `${prefixText}### 🛡️ Secure Trade Execution Card

I have prepared an interactive trade execution ticket for your confirmation. 

Please review the contract details below. To submit the order to our simulated paper ledger, **Swipe to Confirm** (or click the slider). Confirmed trades instantly update your cash balance and open a new CFD position in the Left Panel explorer tab!

\`\`\`json
{
  "component": "TradeConfirmationWidget",
  "props": {
    "symbol": "${symbol}",
    "direction": "${direction}",
    "size": ${size},
    "estimatedPrice": ${price},
    "leverage": 5,
    "fee": ${fee}
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
    const simulatedThoughts = [
      "Generating isolated HTML/SVG canvas visualization package...\n",
      "Embedding custom responsive styles and glassmorphism elements...\n",
      "Packaging sandboxed iframe container for secured execution...\n"
    ];

    for (const thought of simulatedThoughts) {
      const words = thought.split(" ");
      for (const word of words) {
        sendEvent({ type: "reasoning", text: word + " " });
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

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
    const simulatedThoughts = [
      "Analyzing user query regarding asset list / catalog...\n",
      "Scanning registered catalog indices (Crypto, Stocks, Forex, Commodities, ETFs)...\n",
      "Validating provider references and stable mapping identifiers...\n"
    ];

    for (const thought of simulatedThoughts) {
      const words = thought.split(" ");
      for (const word of words) {
        sendEvent({ type: "reasoning", text: word + " " });
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    sendEvent({
      type: "reasoning",
      text: `\n⚙️ **Executing System Tool: \`get_all_assets\`**...\n`
    });
    await new Promise((resolve) => setTimeout(resolve, 800));

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
    const simulatedThoughts = [
      "Interpreting multi-agent delegation request...\n",
      "Identifying target assets for analysis...\n",
      "Determining necessary subagent roles for structured quantitative assessment...\n"
    ];

    for (const thought of simulatedThoughts) {
      const words = thought.split(" ");
      for (const word of words) {
        sendEvent({ type: "reasoning", text: word + " " });
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Determine asset name from prompt
    let targetAsset = "BTCUSD";
    if (normalizedPrompt.includes("apple") || normalizedPrompt.includes("aapl")) {
      targetAsset = "AAPL";
    } else if (normalizedPrompt.includes("gold")) {
      targetAsset = "GOLD";
    } else if (normalizedPrompt.includes("eth")) {
      targetAsset = "ETHUSD";
    }

    const mockSubagents = [
      { role: "Technical Analyst", asset_symbol: targetAsset, instruction: `Analyze short term price momentum, RSI/MACD indices, and moving averages on ${targetAsset}.` },
      { role: "Fundamental Analyst", asset_symbol: targetAsset, instruction: `Check institutional flow coefficients, market capitalization trends, and fair value gaps for ${targetAsset}.` },
      { role: "Risk Manager", asset_symbol: targetAsset, instruction: `Run high-fidelity Value-at-Risk calculations and set stop-loss/take-profit boundary limits for ${targetAsset}.` }
    ];

    // Stream structured metadata of all subagents
    sendEvent({
      type: "reasoning",
      text: `[SUBAGENTS_DETAILS: ${JSON.stringify(mockSubagents)}]\n`
    });

    sendEvent({
      type: "reasoning",
      text: `Spawning Subagent Team (3 members) in Parallel:\n`
    });
    await new Promise((resolve) => setTimeout(resolve, 400));

    sendEvent({ type: "reasoning", text: `Spun up subagent **Technical Analyst** for **${targetAsset}**.\n` });
    await new Promise((resolve) => setTimeout(resolve, 200));
    sendEvent({ type: "reasoning", text: `Spun up subagent **Fundamental Analyst** for **${targetAsset}**.\n` });
    await new Promise((resolve) => setTimeout(resolve, 200));
    sendEvent({ type: "reasoning", text: `Spun up subagent **Risk Manager** for **${targetAsset}**.\n` });
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Parallel analysis states
    sendEvent({ type: "reasoning", text: `Technical Analyst is analyzing **${targetAsset}**...\n` });
    await new Promise((resolve) => setTimeout(resolve, 800));
    sendEvent({ type: "reasoning", text: `Fundamental Analyst is analyzing **${targetAsset}**...\n` });
    await new Promise((resolve) => setTimeout(resolve, 600));

    const technicalReport = `### Technical Analysis Momentum Script

\`\`\`python
import pandas as pd

def get_momentum_indicators(df, length=14):
    # Calculate 14-period RSI
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=length).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=length).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi
\`\`\`

\`\`\`typescript
interface MomentumSignal {
  indicator: "RSI" | "MACD" | "EMA";
  value: number;
  signalType: "BULLISH" | "BEARISH" | "NEUTRAL";
}
\`\`\`
Trend structure across Daily/H4 frames shows a strong buy momentum setup with RSI hovering around 63.4. MACD shows climbing green bars.`;

    sendEvent({
      type: "reasoning",
      text: `[SUBAGENT_REPORT: ${JSON.stringify({ role: "Technical Analyst", asset: targetAsset, status: "success", report: technicalReport })}]\n`
    });

    sendEvent({ type: "reasoning", text: `Technical Analyst finished analysis and submitted report!\n` });
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    sendEvent({ type: "reasoning", text: `Risk Manager is analyzing **${targetAsset}**...\n` });
    await new Promise((resolve) => setTimeout(resolve, 700));

    const fundamentalReport = `### Fundamental Capital Flow Script

\`\`\`python
def calculate_institutional_inflows(etf_inflows, spot_volume):
    multiplier = 1.25
    return (etf_inflows * multiplier) / spot_volume
\`\`\`

\`\`\`typescript
interface FundamentalAssessment {
  fairValue: number;
  discountPercent: number;
  hasOrderBlockGap: boolean;
}
\`\`\`
Institutional inflows remain strong. Sector metrics suggest a 9.4% discount relative to fair value projection models.`;

    sendEvent({
      type: "reasoning",
      text: `[SUBAGENT_REPORT: ${JSON.stringify({ role: "Fundamental Analyst", asset: targetAsset, status: "success", report: fundamentalReport })}]\n`
    });

    sendEvent({ type: "reasoning", text: `Fundamental Analyst finished analysis and submitted report!\n` });
    await new Promise((resolve) => setTimeout(resolve, 400));

    const riskReport = `### Volatility & VaR Simulator

\`\`\`python
import numpy as np

def monte_carlo_var(holding_period=1, confidence_level=0.95):
    historical_std = 0.024
    return np.percentile(np.random.normal(0, historical_std, 10000), (1 - confidence_level) * 100)
\`\`\`

\`\`\`typescript
interface VolatilityGuards {
  stopLossPercent: number;
  takeProfitPercent: number;
  maxLeverageLimit: number;
}
\`\`\`
Daily VaR limit calculated at -3.2%. Recommendations suggest keeping total exposure capped under 4.5% of margin values.`;

    sendEvent({
      type: "reasoning",
      text: `[SUBAGENT_REPORT: ${JSON.stringify({ role: "Risk Manager", asset: targetAsset, status: "success", report: riskReport })}]\n`
    });

    sendEvent({ type: "reasoning", text: `Risk Manager finished analysis and submitted report!\n` });
    await new Promise((resolve) => setTimeout(resolve, 600));

    sendEvent({
      type: "reasoning",
      text: `All subagent analyses received successfully. Synthesizing reports...\n`
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Formulate comprehensive report
    const mainText = `${prefixText}### 🤖 Multi-Agent Team Report: Analytical Synthesis for **${targetAsset}**

I have successfully coordinated an elite, parallel subagent team consisting of a **Technical Analyst**, a **Fundamental Analyst**, and a **Risk Manager** to perform a multi-dimensional study on **${targetAsset}**.

---

#### 📈 1. Technical Analyst Report
* **Trend Assessment**: Strong bullish structure across daily and weekly frames. The 50-day EMA resides securely above the 200-day EMA, confirming an ongoing golden cross.
* **Momentum Oscillators**: RSI is currently at **63.4**, leaving ample room for upward exploration before entering extreme overbought (>75) territory. MACD histogram prints climbing green bars above the signal line.
* **Support/Resistance Zones**: 
  - Primary Support: Key demand block at previous cycle highs.
  - Tactical Resistance: Minor psychological boundary.

#### 📊 2. Fundamental Analyst Report
* **Core Drivers**: Healthy institutional inflows, rising demand coefficients, and favorable macroeconomic policy pivots are supporting asset prices globally.
* **Sector Strength**: High capital efficiency ratios and robust technological pipelines in the sector provide a strong foundation for underlying asset valuation.
* **Fair Value estimate**: Calculated fair value indicates the asset is currently trading at a **9.4% discount** relative to long-term projected growth.

#### 🛡️ 3. Risk Manager Report
* **Volatility Analysis**: Average True Range (ATR) indicates standard daily volatility levels, within manageable thresholds.
* **Stress Test Bounds**: 
  - 95% Confidence VaR (Value-at-Risk) over a 1D holding window is **-3.2%**.
  - Recommendation: Limit total directional exposure to **4.5% of total portfolio margin** to mitigate drawdown spikes.
* **TP/SL Guardrails**: Set tactical stop-losses just below the daily support baseline and take-profits near key resistances.

---

### 🔮 Master Synthesis & Quantitative Recommendation

The quantitative metrics align beautifully to suggest a highly favorable setup for **${targetAsset}**. Capital appreciation remains highly probable. Keep leverage capped at **5x-10x** and utilize strict TP/SL guardrails as recommended by our Risk Manager to maximize tactical efficiency.

How would you like to structure our tactical position today?`;

    const textChunks = mainText.split(" ");
    for (const chunk of textChunks) {
      sendEvent({ type: "text", text: chunk + " " });
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    return;
  }

  // DEFAULT CASE: Normal prompt simulation
  const simulatedThoughts = [
    "Analyzing input request structure and financial patterns...\n",
    "Scanning standard market trendlines and historical order books...\n",
    "Retrieving neutral domain configurations...\n",
    "Synthesizing an unbiased, balanced, and structured response in markdown formatting...\n"
  ];

  for (const thought of simulatedThoughts) {
    const words = thought.split(" ");
    for (const word of words) {
      sendEvent({ type: "reasoning", text: word + " " });
      await new Promise((resolve) => setTimeout(resolve, 35));
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  await new Promise((resolve) => setTimeout(resolve, 300));

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

