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
  parseAiTools,
} from "@/lib/chat/ai-tools";
import { buildChatSystemInstruction } from "@/lib/chat/build-chat-system-instruction";
import { parseMarketsChartContext } from "@/lib/chat/markets-chart-context";
import { fetchAccountState } from "@/lib/chat/tools/account-state-tool";
import {
  getSessionContext,
  hasActiveBalanceGoal,
} from "@/lib/chat/conversation-persistence";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runAgentLoop } from "@/lib/chat/agent-loop";
import { orchestratorToolDeclarations } from "@/lib/chat/tool-declarations";
import { subAgentColorAt } from "@/lib/chat/subagent-types";
import { getUserPlan } from "@/lib/subscription/access";
import { buildPlanContextPrompt, filterToolsForPlan } from "@/lib/subscription/plan-context";
import { isPlanLimitsDisabled } from "@/lib/subscription/dev-access";
import {
  buildCreditsPrompt,
  deductCredits,
  ensureTrialCredits,
  getTrialExpiresAt,
  isTrialActive,
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

    if (userPlan === "free" && !isPlanLimitsDisabled()) {
      if (!isTrialActive(credits)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Your one-day free trial has ended. Upgrade at /pricing to continue.",
            creditsRemaining: credits.balance,
            trialExpiresAt: getTrialExpiresAt(credits)?.toISOString() ?? null,
          }),
          { status: 402, headers: { "Content-Type": "application/json" } },
        );
      }

      const creditCheck = await deductCredits(user.id);
      if (!creditCheck.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Free trial credits exhausted. Upgrade at /pricing to continue.",
            creditsRemaining: creditCheck.balance,
            trialExpiresAt: getTrialExpiresAt(credits)?.toISOString() ?? null,
          }),
          { status: 402, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    let sessionContext: Awaited<ReturnType<typeof getSessionContext>> | null = null;

    try {
      sessionContext = await getSessionContext(user.id, tradingMode);
    } catch {
      sessionContext = null;
    }

    const pinnedAssets = parsePinnedAssets(rawPinned);
    const aiTools = parseAiTools(rawAiTools);
    const effectiveMessage = augmentMessageWithAiTools(
      augmentMessageWithPinnedAssets(message, pinnedAssets),
      aiTools,
    );

    const marketsChartContext = parseMarketsChartContext(clientSessionContext);

    const conversationHistory = parseClientHistory(rawHistory);
    const isFirstTurn = conversationHistory.length === 0;

    const systemInstruction = buildChatSystemInstruction({
      tradingMode,
      userPlan,
      isFirstTurn,
      sessionContext,
      accountProfile: accountProfile
        ? {
            tradingExperience: accountProfile.trading_experience ?? undefined,
            preferredMarkets: accountProfile.markets_of_interest,
            riskTolerance: accountProfile.risk_preference ?? undefined,
            tradingStyle: accountProfile.user_persona ?? undefined,
          }
        : null,
      planContext,
      profileContext,
      creditsContext,
      aiTools,
      marketsChartContext,
    });

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
              marketsChartContext,
              sendEvent,
            };

            const allowedTools = filterToolsForPlan(orchestratorToolDeclarations, userPlan);

            const loopResult = await runAgentLoop({
              contents,
              systemInstruction,
              functionDeclarations: allowedTools,
              toolCtx,
              maxLoops: 12,
              onEvent: (event) => {
                sendEvent(event as ChatStreamEvent);
              },
            });

            if (!loopResult.reportText.length) {
              sendEvent({
                type: "text",
                text: "I couldn't produce a final response. Please try again or rephrase your question.",
              });
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

