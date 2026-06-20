import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import { CapitalBroker } from "@quant/broker"

export const marketDataToolDefinitions: Tool[] = [
  {
    name: "get_realtime_quote",
    description: "Fetch real-time bid/ask/spot price and 24h change for a symbol from Capital.com",
    inputSchema: {
      type: "object" as const,
      properties: {
        symbol: { type: "string", description: "Capital.com epic e.g. US100, GOLD, EURUSD" }
      },
      required: ["symbol"]
    }
  },
  {
    name: "get_ohlcv_candles",
    description: "Fetch OHLCV candle history for a symbol. Returns up to 200 candles.",
    inputSchema: {
      type: "object" as const,
      properties: {
        symbol: { type: "string" },
        resolution: {
          type: "string",
          enum: ["MINUTE_5", "MINUTE_15", "HOUR", "DAY"],
          description: "Candle resolution — default HOUR"
        },
        limit: { type: "number", description: "Max candles to return (default 100, max 200)" }
      },
      required: ["symbol"]
    }
  }
]

export async function executeMarketDataTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const broker = CapitalBroker.fromEnv()

  switch (name) {
    case "get_realtime_quote": {
      const symbol = String(args.symbol)
      const quote = await broker.fetchQuote(symbol)
      return {
        symbol: quote.symbol,
        bid: quote.bid,
        ask: quote.ask,
        spot: quote.spot,
        change24hPct: quote.change24hPct,
        spread: (quote.ask - quote.bid).toFixed(5),
        fetchedAt: new Date().toISOString()
      }
    }

    case "get_ohlcv_candles": {
      const symbol = String(args.symbol)
      const resolutions = ["MINUTE_5", "MINUTE_15", "HOUR", "DAY"] as const
      type Resolution = typeof resolutions[number]
      const resolution = (args.resolution as Resolution | undefined) ?? "HOUR"
      const limit = Math.min(Number(args.limit ?? 100), 200)
      const candles = await broker.fetchCandles(symbol, resolution, limit)
      return {
        symbol,
        resolution,
        count: candles.length,
        candles: candles.slice(-50) // Return last 50 in response to save context window
      }
    }

    default:
      throw new Error(`Unknown market-data tool: ${name}`)
  }
}
