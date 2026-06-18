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

      default:
        throw new Error(`MCP Tool ${name} not found`);
    }
  }
}
export const quantMCP = new QuantMCPRegistry();
export default quantMCP;
