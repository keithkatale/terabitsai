import { searchMarketIntel, getLatestCatalystBrief, getMacroRegime, findHistoricalAnalogs, getRippleGraph } from "@quant/market-intel";
import { RAGEngine, RAGChunk } from "@quant/rag-engine"
import { detectSMC, Candle, MarketStructureResult } from "@quant/indicators"
import path from "path"
import fs from "fs"

export interface MCPToolDefinition {
  name: string;
  description: string;
  parameters: any;
}

export class QuantMCPRegistry {
  private ragEngine: RAGEngine;
  private kbRoot: string;

  constructor() {
    let kb = path.join(process.cwd(), "knowledge-base");
    if (!fs.existsSync(kb)) {
      kb = path.join(process.cwd(), "..", "knowledge-base");
    }
    if (!fs.existsSync(kb)) {
      kb = path.join(process.cwd(), "..", "..", "knowledge-base");
    }
    this.kbRoot = kb;
    this.ragEngine = new RAGEngine(this.kbRoot);
  }

  /**
   * List available tools for the trading agent
   */
  public listTools(): MCPToolDefinition[] {
    return [
      {
        name: "query_trading_knowledge",
        description: "Queries the RAG database for trading guides, Smart Money Concepts (SMC), indicators, or broker configurations.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query. e.g. 'order blocks' or 'risk limits'" },
            category: { type: "string", enum: ["concepts", "markets", "agents", "reference"], description: "Optional folder filter" }
          },
          required: ["query"]
        }
      },
      {
        name: "get_market_rules",
        description: "Pulls quantitative metrics, reliability targets, or leverage restrictions for an asset class.",
        parameters: {
          type: "object",
          properties: {
            market: { type: "string", enum: ["stocks", "crypto", "forex", "options"], description: "Asset market" }
          },
          required: ["market"]
        }
      },
      {
        name: "calculate_smc_levels",
        description: "Calculates Fair Value Gaps (FVG) and Order Blocks (OB) given an OHLCV candle history.",
        parameters: {
          type: "object",
          properties: {
            candles: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  time: { type: "number" },
                  open: { type: "number" },
                  high: { type: "number" },
                  low: { type: "number" },
                  close: { type: "number" },
                  volume: { type: "number" }
                },
                required: ["time", "open", "high", "low", "close", "volume"]
              }
            }
          },
          required: ["candles"]
        }
      },
      {
        name: "search_market_intel",
        description: "Hybrid search over ingested market intelligence documents (news, macro, flow, filings) with provenance URLs.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Natural language search e.g. why are semis down" },
            symbol: { type: "string", description: "Optional ticker filter" },
            diet: { type: "string", enum: ["catalyst", "fundamental", "flow", "macro", "calendar", "onchain"] }
          },
          required: ["query"]
        }
      },
      {
        name: "get_catalyst_brief",
        description: "Latest AI synthesis brief for a symbol with impact score and provenance.",
        parameters: {
          type: "object",
          properties: { symbol: { type: "string" } },
          required: ["symbol"]
        }
      },
      {
        name: "get_macro_regime",
        description: "Current macro regime snapshot from FRED data (risk-on/off, rates, vol).",
        parameters: { type: "object", properties: {} }
      },
      {
        name: "get_entity_ripple",
        description: "Entity graph ripple effects from a root symbol (peers, sectors, supply chain links).",
        parameters: {
          type: "object",
          properties: { symbol: { type: "string" } },
          required: ["symbol"]
        }
      },
      {
        name: "find_historical_analogs",
        description: "Find similar past market events and forward returns.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            symbol: { type: "string" }
          },
          required: ["query"]
        }
      }
    ];
  }

  /**
   * Executes a tool by name with arguments.
   */
  public async executeTool(name: string, args: any): Promise<any> {
    switch (name) {
      case "query_trading_knowledge": {
        const { query, category } = args;
        const results = this.ragEngine.query(query, 4, category);
        return {
          success: true,
          query,
          results: results.map(r => ({
            title: r.title,
            file: r.filePath,
            category: r.category,
            content: r.content
          }))
        };
      }

      case "get_market_rules": {
        const { market } = args;
        const metricsPath = path.join(this.kbRoot, "reference", "market-metrics.json");
        const riskPath = path.join(this.kbRoot, "reference", "risk-rules.json");

        try {
          const metricsRaw = fs.readFileSync(metricsPath, "utf8");
          const riskRaw = fs.readFileSync(riskPath, "utf8");
          const metrics = JSON.parse(metricsRaw);
          const risk = JSON.parse(riskRaw);

          return {
            success: true,
            market,
            metrics: metrics.markets?.[market] || metrics[market] || {},
            limits: risk.limits?.[market] || risk[market] || {}
          };
        } catch (err: any) {
          return { success: false, error: `Could not load reference files: ${err.message}` };
        }
      }

      case "calculate_smc_levels": {
        const { candles } = args as { candles: Candle[] };
        try {
          const smcResult = detectSMC(candles);
          return {
            success: true,
            fvgCount: smcResult.fvgs.length,
            orderBlockCount: smcResult.orderBlocks.length,
            activeOrderBlocks: smcResult.orderBlocks.filter(ob => !ob.mitigated),
            activeFVGs: smcResult.fvgs.filter(fvg => !fvg.mitigated),
            structureBreak: smcResult.bos,
            characterShift: smcResult.choch
          };
        } catch (err: any) {
          return { success: false, error: `SMC calculation failed: ${err.message}` };
        }
      }

      case "search_market_intel": {
        const { query, symbol, diet } = args as { query: string; symbol?: string; diet?: string };
        const kbResults = this.ragEngine.query(query, 3);
        const intelResults = await searchMarketIntel({ query, symbol, diet, limit: 6 });
        return {
          success: true,
          query,
          knowledgeBase: kbResults.map((r) => ({ title: r.title, content: r.content.slice(0, 400), category: r.category })),
          marketIntel: intelResults
        };
      }

      case "get_catalyst_brief": {
        const { symbol } = args as { symbol: string };
        const brief = await getLatestCatalystBrief(symbol?.toUpperCase());
        return brief ? { success: true, brief } : { success: false, error: "No catalyst brief found" };
      }

      case "get_macro_regime": {
        const regime = await getMacroRegime();
        return regime ? { success: true, regime } : { success: false, error: "No macro regime data" };
      }

      case "get_entity_ripple": {
        const { symbol } = args as { symbol: string };
        const graph = await getRippleGraph(symbol?.toUpperCase());
        return { success: true, ...graph };
      }

      case "find_historical_analogs": {
        const { query, symbol } = args as { query: string; symbol?: string };
        const analogs = await findHistoricalAnalogs(query, symbol?.toUpperCase());
        return { success: true, analogs };
      }

      default:
        throw new Error(`MCP Tool ${name} not found`);
    }
  }
}
export const quantMCP = new QuantMCPRegistry();
export default quantMCP;
