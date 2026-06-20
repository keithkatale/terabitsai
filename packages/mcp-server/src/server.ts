import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js"
import { marketDataToolDefinitions, executeMarketDataTool } from "./tools/market-data.js"
import { quantToolDefinitions, executeQuantTool } from "./tools/quant-tools.js"
import { intelToolDefinitions, executeIntelTool } from "./tools/intel-tools.js"
import { portfolioToolDefinitions, executePortfolioTool } from "./tools/portfolio.js"
// Legacy registry kept for backward compatibility
import { quantMCP } from "./index.js"

const ALL_TOOLS = [
  ...marketDataToolDefinitions,
  ...quantToolDefinitions,
  ...intelToolDefinitions,
  ...portfolioToolDefinitions
]

const LEGACY_TOOLS = quantMCP.listTools().map((t) => ({
  name: t.name,
  description: t.description,
  inputSchema: { type: "object" as const, ...t.parameters }
}))

// Merge all tools into a single map, preferring new definitions where names overlap
type AnyTool = { name: string; description: string; inputSchema: unknown }
const TOOL_MAP = new Map<string, AnyTool>([
  ...LEGACY_TOOLS.map((t) => [t.name, t as AnyTool] as [string, AnyTool]),
  ...ALL_TOOLS.map((t) => [t.name, { name: t.name, description: t.description ?? "", inputSchema: t.inputSchema } as AnyTool] as [string, AnyTool])
])

/**
 * Full MCP protocol server for the AQWM platform.
 * Runs over stdio transport — started as a subprocess by the agent or engine.
 */
export function createQuantMCPServer(): Server {
  const server = new Server(
    { name: "quant-mcp-server", version: "2.0.0" },
    { capabilities: { tools: {}, resources: {} } }
  )

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: Array.from(TOOL_MAP.values()) }
  })

  // Execute a tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    const toolArgs = (args ?? {}) as Record<string, unknown>

    try {
      let result: unknown

      if (marketDataToolDefinitions.some((t) => t.name === name)) {
        result = await executeMarketDataTool(name, toolArgs)
      } else if (quantToolDefinitions.some((t) => t.name === name)) {
        result = executeQuantTool(name, toolArgs)
      } else if (intelToolDefinitions.some((t) => t.name === name)) {
        result = await executeIntelTool(name, toolArgs)
      } else if (portfolioToolDefinitions.some((t) => t.name === name)) {
        result = await executePortfolioTool(name, toolArgs)
      } else {
        // Fall back to legacy registry
        result = await quantMCP.executeTool(name, toolArgs)
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }]
      }
    } catch (err) {
      if (err instanceof McpError) throw err
      throw new McpError(ErrorCode.InternalError, String(err))
    }
  })

  // List resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "quant://watchlist",
          name: "Active Watchlist",
          description: "Current ENGINE_WATCHLIST symbols",
          mimeType: "application/json"
        },
        {
          uri: "quant://risk-config",
          name: "Risk Configuration",
          description: "Current DEFAULT_RISK_CONFIG parameters",
          mimeType: "application/json"
        }
      ]
    }
  })

  // Read a resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params

    if (uri === "quant://watchlist") {
      const watchlist = (process.env.ENGINE_WATCHLIST ?? "US100,US500,GOLD").split(",").map((s) => s.trim())
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify({ watchlist }, null, 2)
        }]
      }
    }

    if (uri === "quant://risk-config") {
      const { DEFAULT_RISK_CONFIG } = await import("@quant/contracts")
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(DEFAULT_RISK_CONFIG, null, 2)
        }]
      }
    }

    throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`)
  })

  return server
}

/**
 * Start the MCP server over stdio (for subprocess use).
 */
export async function startMCPServer(): Promise<void> {
  const server = createQuantMCPServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("[mcp-server] Quant MCP Server v2.0.0 running on stdio")
}
