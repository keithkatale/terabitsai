import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import {
  searchMarketIntel,
  getLatestCatalystBrief,
  getMacroRegime,
  getRippleGraph,
  findHistoricalAnalogs
} from "@quant/market-intel"

export const intelToolDefinitions: Tool[] = [
  {
    name: "search_market_intel",
    description: "Hybrid semantic search over ingested market intelligence: news, macro, catalysts, flow, filings. Returns ranked results with provenance.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Natural language query e.g. 'why are semis down'" },
        symbol: { type: "string", description: "Optional ticker filter e.g. NVDA" },
        diet: {
          type: "string",
          enum: ["catalyst", "fundamental", "flow", "macro", "calendar", "onchain"],
          description: "Optional document type filter"
        },
        limit: { type: "number", description: "Max results (default 6)" }
      },
      required: ["query"]
    }
  },
  {
    name: "get_catalyst_brief",
    description: "Get latest AI synthesis brief for a symbol: headline, thesis, bullish/bearish bullets, impact score, and source provenance.",
    inputSchema: {
      type: "object" as const,
      properties: {
        symbol: { type: "string" }
      },
      required: ["symbol"]
    }
  },
  {
    name: "get_macro_regime",
    description: "Get current macro regime snapshot: risk-on/off classification, key themes, and FRED data (rates, CPI, VIX).",
    inputSchema: {
      type: "object" as const,
      properties: {}
    }
  },
  {
    name: "get_entity_ripple",
    description: "Get entity graph ripple effects from a root symbol: peers, sector links, supply chain relationships, and correlated movers.",
    inputSchema: {
      type: "object" as const,
      properties: {
        symbol: { type: "string" }
      },
      required: ["symbol"]
    }
  },
  {
    name: "find_historical_analogs",
    description: "Find historical market events analogous to the current situation with forward return data (1d, 1w).",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Description of current situation e.g. 'tech selloff after rate hike'" },
        symbol: { type: "string", description: "Optional symbol context" }
      },
      required: ["query"]
    }
  }
]

export async function executeIntelTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "search_market_intel": {
      const results = await searchMarketIntel({
        query: String(args.query),
        symbol: args.symbol ? String(args.symbol) : undefined,
        diet: args.diet as string | undefined,
        limit: Number(args.limit ?? 6)
      })
      return { success: true, count: results.length, results }
    }

    case "get_catalyst_brief": {
      const brief = await getLatestCatalystBrief(String(args.symbol).toUpperCase())
      return brief
        ? { success: true, brief }
        : { success: false, error: `No catalyst brief found for ${args.symbol}` }
    }

    case "get_macro_regime": {
      const regime = await getMacroRegime()
      return regime
        ? { success: true, regime }
        : { success: false, error: "No macro regime data available" }
    }

    case "get_entity_ripple": {
      const graph = await getRippleGraph(String(args.symbol).toUpperCase())
      return { success: true, ...graph }
    }

    case "find_historical_analogs": {
      const analogs = await findHistoricalAnalogs(
        String(args.query),
        args.symbol ? String(args.symbol).toUpperCase() : undefined
      )
      return { success: true, count: analogs.length, analogs }
    }

    default:
      throw new Error(`Unknown intel tool: ${name}`)
  }
}
