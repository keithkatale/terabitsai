import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import { CapitalBroker } from "@quant/broker"

export const portfolioToolDefinitions: Tool[] = [
  {
    name: "get_portfolio_state",
    description: "Get current portfolio state: account balance, available margin, open positions, daily P&L, and risk metrics.",
    inputSchema: {
      type: "object" as const,
      properties: {}
    }
  },
  {
    name: "simulate_risk",
    description: "Simulate risk impact of a potential trade without executing it. Returns position sizing, margin requirement, and risk/reward metrics.",
    inputSchema: {
      type: "object" as const,
      properties: {
        symbol: { type: "string" },
        side: { type: "string", enum: ["BUY", "SELL"] },
        confidence: { type: "number", description: "Agent confidence 0-1" },
        suggestedStopPct: { type: "number", description: "Stop loss % e.g. 0.01 for 1%" },
        suggestedSizeHint: { type: "number", description: "Optional size hint in units" }
      },
      required: ["symbol", "side", "confidence"]
    }
  }
]

export async function executePortfolioTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "get_portfolio_state": {
      try {
        const broker = CapitalBroker.fromEnv()
        const [accounts, positions] = await Promise.all([
          broker.getAccounts(),
          broker.getOpenPositions()
        ])

        const account = accounts[0]
        const totalExposure = positions.reduce((sum, p) => sum + p.volume * p.entryPrice, 0)
        const totalUnrealizedPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0)

        return {
          success: true,
          account: account ?? null,
          openPositions: positions,
          metrics: {
            openPositionCount: positions.length,
            totalExposure: totalExposure.toFixed(2),
            totalUnrealizedPnl: totalUnrealizedPnl.toFixed(2),
            exposurePct: account ? ((totalExposure / account.balance) * 100).toFixed(1) + "%" : "unknown"
          }
        }
      } catch (err) {
        return { success: false, error: `Broker unavailable: ${String(err)}` }
      }
    }

    case "simulate_risk": {
      const { DEFAULT_RISK_CONFIG } = await import("@quant/contracts")
      const { evaluateRisk } = await import("@quant/risk")

      try {
        const broker = CapitalBroker.fromEnv()
        const [quote, accounts, positions] = await Promise.all([
          broker.fetchQuote(String(args.symbol)),
          broker.getAccounts(),
          broker.getOpenPositions()
        ])

        const account = accounts[0]
        const portfolio = {
          accountBalance: account?.balance ?? 100_000,
          availableMargin: account?.available ?? 80_000,
          dailyPnl: account?.profitLoss ?? 0,
          openPositions: positions,
          consecutiveLosses: 0,
          dataStale: false
        }

        const proposal = {
          symbol: String(args.symbol).toUpperCase(),
          side: args.side as "BUY" | "SELL",
          confidence: Number(args.confidence),
          timeHorizon: "swing" as const,
          rationale: "Risk simulation",
          agentVotes: [],
          suggestedStopPct: Number(args.suggestedStopPct ?? 0.01),
          suggestedSizeHint: Number(args.suggestedSizeHint ?? 0)
        }

        const decision = evaluateRisk({ proposal, portfolio, config: DEFAULT_RISK_CONFIG, currentPrice: quote.spot })

        return {
          success: true,
          currentPrice: quote.spot,
          riskDecision: decision,
          summary: decision.approved
            ? `APPROVED: ${decision.sizedOrder?.volume} units at ${quote.spot}. SL: ${decision.sizedOrder?.stopLoss}, TP: ${decision.sizedOrder?.takeProfit}`
            : `REJECTED: ${decision.reasons.join("; ")}`
        }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }

    default:
      throw new Error(`Unknown portfolio tool: ${name}`)
  }
}
