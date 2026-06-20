import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import { detectSMC, ema, rsi, macd, type Candle } from "@quant/indicators"

export const quantToolDefinitions: Tool[] = [
  {
    name: "calculate_smc_levels",
    description: "Detect Smart Money Concept levels: Fair Value Gaps (FVG), Order Blocks (OB), Break of Structure (BOS), and Change of Character (CHOCH) from OHLCV candles.",
    inputSchema: {
      type: "object" as const,
      properties: {
        candles: {
          type: "array",
          description: "Array of OHLCV candles",
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
    name: "calculate_indicators",
    description: "Calculate technical indicators (EMA, RSI, MACD) from closing prices.",
    inputSchema: {
      type: "object" as const,
      properties: {
        closes: {
          type: "array",
          items: { type: "number" },
          description: "Array of closing prices (most recent last)"
        },
        indicators: {
          type: "array",
          items: { type: "string", enum: ["ema20", "ema50", "ema200", "rsi", "macd"] },
          description: "Which indicators to compute"
        }
      },
      required: ["closes"]
    }
  }
]

export function executeQuantTool(name: string, args: Record<string, unknown>): unknown {
  switch (name) {
    case "calculate_smc_levels": {
      const candles = args.candles as Candle[]
      if (!Array.isArray(candles) || candles.length < 5) {
        return { success: false, error: "At least 5 candles required for SMC analysis" }
      }

      const result = detectSMC(candles)
      const activeFVGs = result.fvgs.filter((f) => !f.mitigated)
      const activeOBs = result.orderBlocks.filter((o) => !o.mitigated)

      return {
        success: true,
        summary: {
          bos: result.bos,
          choch: result.choch,
          activeFVGCount: activeFVGs.length,
          activeOBCount: activeOBs.length
        },
        activeFVGs: activeFVGs.map((f) => ({
          type: f.type,
          top: f.top,
          bottom: f.bottom,
          midpoint: (f.top + f.bottom) / 2
        })),
        activeOrderBlocks: activeOBs.map((o) => ({
          type: o.type,
          high: o.high,
          low: o.low,
          midpoint: (o.high + o.low) / 2,
          volume: o.volume
        }))
      }
    }

    case "calculate_indicators": {
      const closes = args.closes as number[]
      const requested = (args.indicators as string[] | undefined) ?? ["ema20", "ema50", "rsi", "macd"]

      if (!Array.isArray(closes) || closes.length < 14) {
        return { success: false, error: "At least 14 closes required" }
      }

      const result: Record<string, number | null> = {}

      if (requested.includes("ema20") && closes.length >= 20) {
        const emaVals = ema(closes, 20)
        result.ema20 = emaVals[emaVals.length - 1] ?? null
      }
      if (requested.includes("ema50") && closes.length >= 50) {
        const emaVals = ema(closes, 50)
        result.ema50 = emaVals[emaVals.length - 1] ?? null
      }
      if (requested.includes("ema200") && closes.length >= 200) {
        const emaVals = ema(closes, 200)
        result.ema200 = emaVals[emaVals.length - 1] ?? null
      }
      if (requested.includes("rsi")) result.rsi = rsi(closes, 14)
      if (requested.includes("macd")) {
        const macdResult = macd(closes)
        if (macdResult) {
          result.macdLine = macdResult.macd
          result.signalLine = macdResult.signal
          result.histogram = macdResult.histogram
        }
      }

      return { success: true, indicators: result }
    }

    default:
      throw new Error(`Unknown quant tool: ${name}`)
  }
}
