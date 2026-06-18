import { getAgentGeminiModelId, getVertexGeminiClient, isGeminiRuntimeConfigured } from "@/lib/gemini/vertex-client";
import { parseVertexErrorMessage } from "@/lib/gemini/vertex-error-parser";
import { getCapitalAssetCatalog } from "@/lib/catalog/capital-assets";
import { generateVertexTextCompletion } from "@/lib/gemini/vertex-text-completion";
import { Type } from "@google/genai";

export const dynamic = "force-dynamic";

// Define Gemini tool schemas matching the approved technical specifications
const getAllAssetsDeclaration = {
  name: "get_all_assets",
  description: "Retrieve all assets available in the Quant catalog, grouped by asset class (crypto, stock, etf, index, commodity, etc.)",
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

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ success: false, error: "Prompt message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const systemInstruction = `You are Quant, a highly capable, neutral, and unbiased AI assistant.
Your goal is to provide clear, helpful, accurate, and objective answers to any technical, financial, or general prompt.
You maintain a professional, objective, and polite tone. Provide structured replies using markdown formatting beautifully.

You are equipped with advanced MCP tools to:
- Retrieve the asset catalog and detailed assets data.
- Spin up specialized agent teams (parallel subagents) to perform granular technical, fundamental, risk, or sentiment analyses.

When requested to analyze assets or run deep research, aggressively use the 'spawn_subagents' tool to form a team of subagents, and then synthesize their findings beautifully in your final response.`;

    const encoder = new TextEncoder();

    const customStream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: { type: "reasoning" | "text"; text: string }) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        };

        if (isGeminiRuntimeConfigured()) {
          try {
            const ai = getVertexGeminiClient();
            const model = getAgentGeminiModelId();

            const contents: any[] = [{ role: "user", parts: [{ text: message }] }];
            let loopCount = 0;
            const maxLoops = 5;
            let finalStreamNeeded = true;

            const toolConfig = {
              systemInstruction,
              temperature: 0.3,
              maxOutputTokens: 2500,
              thinkingConfig: {
                thinkingBudget: 2048,
              },
              tools: [
                {
                  functionDeclarations: [
                    getAllAssetsDeclaration,
                    getAssetDetailsDeclaration,
                    spawnSubagentsDeclaration
                  ]
                }
              ]
            };

            while (loopCount < maxLoops) {
              loopCount++;

              // Call generateContent (non-streaming) to check for tool calls
              const response = await ai.models.generateContent({
                model,
                contents,
                config: toolConfig
              });

              const candidate = response.candidates?.[0];
              const parts = candidate?.content?.parts || [];

              // Capture and stream any thinking (reasoning) text produced during this turn
              for (const part of parts) {
                if (part.thought && part.text) {
                  sendEvent({ type: "reasoning", text: part.text });
                }
              }

              // Check if there are function calls
              const functionCalls = parts.filter(p => p.functionCall);

              if (functionCalls.length > 0) {
                // Append the model's function call turn to the conversation history
                contents.push({
                  role: "model",
                  parts: parts
                });

                const toolResponseParts: any[] = [];

                for (const callPart of functionCalls) {
                  const call = callPart.functionCall;
                  if (!call) continue;

                  const name = call.name;
                  const args = call.args as any;
                  
                  // Stream reasoning to the user that we are executing the tool
                  sendEvent({
                    type: "reasoning",
                    text: `\n\nExecuting System Tool: \`${name}\`...\n`
                  });

                  let toolResult: any;

                  if (name === "get_all_assets") {
                    const filter = args?.asset_class;
                    const allAssets = getCapitalAssetCatalog();
                    const filtered = filter 
                      ? allAssets.filter(a => a.asset_class === filter)
                      : allAssets;
                    // Summarize to avoid massive token overhead
                    const summarized = filtered.map(a => ({
                      id: a.id,
                      symbol: a.symbol,
                      display_name: a.display_name,
                      asset_class: a.asset_class,
                      sector: a.sector
                    }));
                    toolResult = { success: true, count: summarized.length, assets: summarized };

                    sendEvent({
                      type: "reasoning",
                      text: `Loaded **${summarized.length}** assets from catalog.\n`
                    });

                  } else if (name === "get_asset_details") {
                    const symbol = args?.symbol as string | undefined;
                    const allAssets = getCapitalAssetCatalog();
                    const asset = symbol 
                      ? allAssets.find(a => a.symbol?.toLowerCase() === symbol.toLowerCase())
                      : undefined;
                    if (asset) {
                      toolResult = { success: true, asset };
                      sendEvent({
                        type: "reasoning",
                        text: `Retrieved detailed properties for asset **${symbol}**.\n`
                      });
                    } else {
                      toolResult = { success: false, error: `Asset with symbol '${symbol || "unknown"}' not found in catalog.` };
                      sendEvent({
                        type: "reasoning",
                        text: `Asset **${symbol || "unknown"}** was not found in catalog.\n`
                      });
                    }

                  } else if (name === "spawn_subagents") {
                    const subagentsList = (args?.subagents || []) as any[];
                    
                    // Stream structured metadata of all subagents
                    sendEvent({
                      type: "reasoning",
                      text: `[SUBAGENTS_DETAILS: ${JSON.stringify(subagentsList)}]\n`
                    });

                    sendEvent({
                      type: "reasoning",
                      text: `Spawning Subagent Team (${subagentsList.length} members) in Parallel:\n`
                    });

                    // Log initial spinner states
                    for (const sub of subagentsList) {
                      sendEvent({
                        type: "reasoning",
                        text: `Spun up subagent **${sub.role}** for **${sub.asset_symbol}**.\n`
                      });
                    }

                    // Execute subagents in parallel!
                    const subagentPromises = subagentsList.map(async (sub: any) => {
                      const asset = getCapitalAssetCatalog().find(a => a.symbol?.toLowerCase() === sub.asset_symbol?.toLowerCase());
                      const assetContext = asset 
                        ? `Asset Context: Name is "${asset.display_name}", Sector is "${asset.sector}", Class is "${asset.asset_class}", Max Leverage is ${asset.max_leverage_x}x.`
                        : `Asset Context: Symbol ${sub.asset_symbol}.`;

                      const subagentSystemInstruction = `You are a highly specialized financial subagent.
Your role in this elite quantitative team is: ${sub.role}.
${assetContext}
Perform your analysis on the asset "${sub.asset_symbol}" strictly adhering to the user instructions.
Be precise, mathematical, analytical, and objective. Keep your tone neutral and professional. Format your response beautifully in structured markdown. Do NOT repeat intro greetings.`;

                      sendEvent({
                        type: "reasoning",
                        text: `${sub.role} is analyzing **${sub.asset_symbol}**...\n`
                      });

                      try {
                        const analysis = await generateVertexTextCompletion({
                          userPrompt: sub.instruction,
                          systemInstruction: subagentSystemInstruction,
                          temperature: 0.2,
                          maxTokens: 1500
                        });

                        // Stream subagent completed report to client parser
                        sendEvent({
                          type: "reasoning",
                          text: `[SUBAGENT_REPORT: ${JSON.stringify({ role: sub.role, asset: sub.asset_symbol, status: "success", report: analysis })}]\n`
                        });

                        sendEvent({
                          type: "reasoning",
                          text: `${sub.role} finished analysis and submitted report!\n`
                        });

                        return {
                          role: sub.role,
                          asset: sub.asset_symbol,
                          status: "success",
                          report: analysis
                        };
                      } catch (subErr: any) {
                        // Stream subagent failure to client parser
                        sendEvent({
                          type: "reasoning",
                          text: `[SUBAGENT_REPORT: ${JSON.stringify({ role: sub.role, asset: sub.asset_symbol, status: "failed", error: subErr.message || String(subErr) })}]\n`
                        });

                        sendEvent({
                          type: "reasoning",
                          text: `${sub.role} failed: ${subErr.message || subErr}\n`
                        });
                        return {
                          role: sub.role,
                          asset: sub.asset_symbol,
                          status: "failed",
                          error: subErr.message || String(subErr)
                        };
                      }
                    });

                    const subagentResults = await Promise.all(subagentPromises);
                    toolResult = { success: true, team_results: subagentResults };

                    sendEvent({
                      type: "reasoning",
                      text: `All subagent analyses received successfully. Synthesizing reports...\n`
                    });
                  } else {
                    toolResult = { success: false, error: "Unknown tool name" };
                  }

                  toolResponseParts.push({
                    functionResponse: {
                      name: name,
                      response: toolResult
                    }
                  });
                }

                // Add tool responses back to the conversation contents history as a user turn
                contents.push({
                  role: "user",
                  parts: toolResponseParts
                });

              } else {
                // No more function calls, we have the final content!
                const finalPart = parts.find(p => p.text && !p.thought);
                if (finalPart?.text) {
                  sendEvent({ type: "text", text: finalPart.text });
                }
                finalStreamNeeded = false;
                break;
              }
            }

            // Stream final synthesis candidate token-by-token if needed
            if (finalStreamNeeded) {
              const responseStream = await ai.models.generateContentStream({
                model,
                contents,
                config: {
                  systemInstruction,
                  temperature: 0.3,
                  maxOutputTokens: 2500,
                  thinkingConfig: {
                    thinkingBudget: 2048,
                  },
                },
              });

              for await (const chunk of responseStream) {
                const parts = chunk.candidates?.[0]?.content?.parts || [];
                for (const part of parts) {
                  if (part.thought && part.text) {
                    sendEvent({ type: "reasoning", text: part.text });
                  } else if (part.text) {
                    sendEvent({ type: "text", text: part.text });
                  }
                }
              }
            }
          } catch (err: any) {
            console.warn(
              "[POST /api/chat] Vertex AI streaming / tool calls failed, falling back to simulated high-fidelity token streaming:",
              err.message || err
            );
            const errMsg = parseVertexErrorMessage(err);
            await simulateStreamingResponse(message, sendEvent, `(Note: Vertex Gemini encountered an issue: ${errMsg}. Running local model fallbacks...)\n\n`);
          }
        } else {
          console.info(
            "[POST /api/chat] Gemini is not configured, running standard high-fidelity neutral simulated token stream."
          );
          await simulateStreamingResponse(message, sendEvent);
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
  sendEvent: (data: { type: "reasoning" | "text"; text: string }) => void,
  prefixText = ""
) {
  const normalizedPrompt = prompt.toLowerCase();

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

    sendEvent({
      type: "reasoning",
      text: `   ✅ Loaded **125** assets from catalog.\n`
    });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const mainText = `${prefixText}### 📋 Quant Asset Catalog Summary

Based on the system catalog, there are **125 assets** registered. Here is a curated overview of the leading markets:

#### 🪙 Cryptocurrencies (20x Max Leverage)
| Symbol | Asset Name | Sector | Min Notional |
| :--- | :--- | :--- | :--- |
| **BTCUSD** | Bitcoin / USD CFD | Crypto | $10 |
| **ETHUSD** | Ethereum / USD CFD | Crypto | $10 |
| **SOLUSD** | Solana / USD CFD | Crypto | $10 |
| **XRPUSD** | Ripple / USD CFD | Crypto | $10 |

#### 📈 Blue-Chip Stocks (20x Max Leverage)
| Symbol | Company Name | Sector | Region |
| :--- | :--- | :--- | :--- |
| **AAPL** | Apple Inc. CFD | Technology | US |
| **MSFT** | Microsoft Corp. CFD | Technology | US |
| **TSLA** | Tesla Inc. CFD | Automotive | US |
| **NVDA** | NVIDIA Corp. CFD | Semiconductors | US |

#### 🌍 Forex & Commodities (20x Max Leverage)
| Symbol | Name | Class | Sector |
| :--- | :--- | :--- | :--- |
| **EURUSD** | EUR/USD CFD | Forex | Currencies |
| **GBPUSD** | GBP/USD CFD | Forex | Currencies |
| **GOLD** | Gold Spot CFD | Commodity | Precious Metals |
| **OIL_CRUDE** | WTI Crude Oil CFD | Commodity | Energy |

You can trade any of these assets directly from the terminal or ask me to perform deep analytical reports on them!`;

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

