import { runOrchestrator } from "@quant/agents"
import { CapitalBroker } from "@quant/broker"
import { DEFAULT_RISK_CONFIG, type PortfolioState } from "@quant/contracts"
import { prisma } from "@quant/db"
import { searchMarketIntel } from "@quant/market-intel"
import { ModelRouter } from "@quant/model-router"
import { evaluateRisk } from "@quant/risk"

const WATCHLIST = (process.env.ENGINE_WATCHLIST ?? "US100,US500,GOLD")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

export async function runTradingLoop(): Promise<void> {
  console.log(`[engine] Starting trading loop — watchlist: ${WATCHLIST.join(", ")}`)
  console.log(
    `[engine] LIVE_EXECUTION_ENABLED=${process.env.LIVE_EXECUTION_ENABLED ?? "false"}`
  )

  const broker = CapitalBroker.fromEnv()
  const router = new ModelRouter()
  const accounts = await broker.getAccounts()
  const primaryAccount = accounts[0]

  if (!primaryAccount) {
    console.warn("[engine] No broker accounts found — using paper defaults")
  }

  const openPositions = await broker.getOpenPositions()

  const portfolio: PortfolioState = {
    accountBalance: primaryAccount?.balance ?? 100_000,
    availableMargin: primaryAccount?.available ?? 80_000,
    dailyPnl: primaryAccount?.profitLoss ?? 0,
    openPositions,
    consecutiveLosses: 0,
    dataStale: false
  }

  for (const symbol of WATCHLIST) {
    try {
      await processSymbol(symbol, broker, router, portfolio)
    } catch (err) {
      console.error(`[engine] Error processing ${symbol}:`, err)
      await logAudit("AGENT_RUN_FAILED", { symbol, error: String(err) })
    }
  }

  console.log("[engine] Loop complete")
}

async function processSymbol(
  symbol: string,
  broker: CapitalBroker,
  router: ModelRouter,
  portfolio: PortfolioState
): Promise<void> {
  console.log(`[engine] Processing ${symbol}...`)

  const quote = await broker.fetchQuote(symbol)
  const candles = await broker.fetchCandles(symbol, "HOUR", 200)

  let newsHeadlines: string[] = []
  try {
    const intel = await searchMarketIntel({ query: `${symbol} market news catalyst`, symbol, limit: 5 })
    newsHeadlines = intel.map((r) => `[${r.source}] ${r.title}: ${r.body.slice(0, 120)}`)
  } catch {
    // DB may be unavailable
  }

  const agentRun = await safeDb(() =>
    prisma.agentRun.create({ data: { symbol, status: "RUNNING" } })
  )

  const { proposal, agentOutputs } = await runOrchestrator(
    {
      symbol,
      currentPrice: quote.spot,
      change24hPct: quote.change24hPct,
      candles,
      newsHeadlines
    },
    router
  )

  if (agentRun) {
    await safeDb(() =>
      prisma.proposal.create({
        data: {
          agentRunId: agentRun.id,
          symbol: proposal.symbol,
          side: proposal.side,
          confidence: proposal.confidence,
          timeHorizon: proposal.timeHorizon,
          rationale: proposal.rationale,
          payload: proposal as object
        }
      })
    )
  }

  const riskDecision = evaluateRisk({
    proposal,
    portfolio,
    config: DEFAULT_RISK_CONFIG,
    currentPrice: quote.spot
  })

  if (agentRun) {
    await safeDb(() =>
      prisma.riskEvaluation.create({
        data: {
          agentRunId: agentRun.id,
          approved: riskDecision.approved,
          reasons: riskDecision.reasons,
          sizedOrder: riskDecision.sizedOrder ?? undefined
        }
      })
    )
  }

  let executionDetails: Record<string, unknown> | null = null

  if (riskDecision.approved && riskDecision.sizedOrder) {
    const result = await broker.executeOrder(
      riskDecision.sizedOrder,
      agentRun ? `engine-${agentRun.id}` : `engine-${Date.now()}`
    )
    executionDetails = result as Record<string, unknown>

    if (result.status === "FILLED" && agentRun) {
      await safeDb(() =>
        prisma.order.create({
          data: {
            agentRunId: agentRun.id,
            symbol: riskDecision.sizedOrder!.symbol,
            side: riskDecision.sizedOrder!.side,
            volume: riskDecision.sizedOrder!.volume,
            stopLoss: riskDecision.sizedOrder!.stopLoss,
            takeProfit: riskDecision.sizedOrder!.takeProfit,
            status: result.status,
            dealId: result.dealId,
            filledPrice: result.filledPrice
          }
        })
      )
    }
  }

  await safeDb(() =>
    prisma.explainabilityLog.create({
      data: {
        symbol: proposal.symbol,
        side: proposal.side,
        confidence: proposal.confidence,
        rationale: proposal.rationale,
        agentVotes: proposal.agentVotes as object,
        riskDecision: {
          approved: riskDecision.approved,
          reasons: riskDecision.reasons
        },
        executionDetails: (executionDetails as object) ?? undefined
      }
    })
  )

  if (agentRun) {
    await safeDb(() =>
      prisma.agentRun.update({
        where: { id: agentRun.id },
        data: { status: "COMPLETED", completedAt: new Date() }
      })
    )
  }

  console.log(
    `[engine] ${symbol}: ${proposal.side} (${proposal.confidence.toFixed(2)}) → risk ${riskDecision.approved ? "APPROVED" : "REJECTED"}`
  )
  console.log(`[engine] Agent outputs:`, agentOutputs)
}

async function safeDb<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn()
  } catch {
    console.warn("[engine] Database unavailable — skipping persistence")
    return null
  }
}

async function logAudit(action: string, details: object): Promise<void> {
  await safeDb(() =>
    prisma.auditLog.create({
      data: { action, details: JSON.stringify(details) }
    })
  )
}

// CLI entry when run directly
const isMain = process.argv[1]?.endsWith("loop.ts") || process.argv[1]?.endsWith("loop.js")
if (isMain && process.argv.includes("--once")) {
  runTradingLoop()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
