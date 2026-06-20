/**
 * OPAR Loop — Observe, Plan, Act, Reflect, Execute
 *
 * This replaces the legacy sequential loop with a structured, checkpointed
 * execution cycle backed by the LangGraph portfolio manager graph.
 *
 * Each phase:
 *  OBSERVE  — fetch market data, build context, recall memory
 *  PLAN     — run specialist agents (intelligence, quant, risk critic)
 *  ACT      — aggregate proposals, run through The Cage
 *  REFLECT  — store outcomes, update episodic memory
 *  EXECUTE  — send approved order to Capital.com
 */

import { CapitalBroker } from "@quant/broker"
import { DEFAULT_RISK_CONFIG, type PortfolioState } from "@quant/contracts"
import { prisma } from "@quant/db"
import { HITLApprovalService, evaluateHITLTriggers } from "@quant/hitl"
import { searchMarketIntel, getMacroRegime } from "@quant/market-intel"
import { memory } from "@quant/memory"
import { theCage } from "@quant/risk"
import { runPortfolioManager } from "@quant/agents"
import type { MarketContext } from "@quant/agents"
import { getRedisClient } from "@quant/memory"

export type OPARLoopConfig = {
  watchlist: string[]
  liveExecution: boolean
}

export type OPARCycleResult = {
  symbol: string
  phase: string
  proposal?: { side: string; confidence: number; rationale: string } | null
  riskDecision?: { approved: boolean; reasons: string[] } | null
  executionResult?: { status: string; dealId?: string } | null
  hitlDecision?: string | null
  durationMs: number
  error?: string
}

/**
 * Run one complete OPAR cycle for a single symbol.
 */
export async function runOPARCycle(
  symbol: string,
  broker: CapitalBroker,
  portfolio: PortfolioState,
  config: OPARLoopConfig
): Promise<OPARCycleResult> {
  const start = Date.now()
  let phase = "OBSERVE"

  try {
    // ─── OBSERVE ──────────────────────────────────────────────────────────────
    const [quote, candles] = await Promise.all([
      broker.fetchQuote(symbol),
      broker.fetchCandles(symbol, "HOUR", 200)
    ])

    let newsHeadlines: string[] = []
    let macroRegime = "unknown"

    try {
      const [intelResults, regime] = await Promise.all([
        searchMarketIntel({ query: `${symbol} market catalyst`, symbol, limit: 5 }),
        getMacroRegime()
      ])
      newsHeadlines = intelResults.map((r) => `[${r.source}] ${r.title}: ${r.body.slice(0, 100)}`)
      if (regime) macroRegime = regime.regime
    } catch {
      // Intel/macro is non-fatal
    }

    const marketContext: MarketContext = {
      symbol,
      currentPrice: quote.spot,
      change24hPct: quote.change24hPct,
      candles,
      newsHeadlines,
      indicators: {},
      macroRegime
    }

    // Recall memory for context enrichment
    const memoryBlock = await memory.buildMemoryBlock({ symbol, strategyName: "smc_swing" })

    // ─── PLAN + ACT (via Portfolio Manager Graph) ──────────────────────────────
    phase = "PLAN"
    const threadId = `opar:${symbol}:${Date.now()}`

    const graphState = await runPortfolioManager({
      symbol,
      marketContext: {
        ...marketContext,
        newsHeadlines: memoryBlock
          ? [...newsHeadlines, `[Memory Context] ${memoryBlock.slice(0, 200)}`]
          : newsHeadlines
      },
      threadId
    })

    const proposal = graphState.trade_proposal
    phase = "ACT"

    // Log agent run to DB
    const agentRun = await safeDb(() =>
      prisma.agentRun.create({ data: { symbol, status: "RUNNING" } })
    )

    if (proposal) {
      await safeDb(() =>
        prisma.proposal.create({
          data: {
            agentRunId: agentRun?.id ?? "no-db",
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

    // Run proposal through The Cage
    let hitlDecision: string | null = null
    let executionResult: OPARCycleResult["executionResult"] = null

    if (proposal && proposal.side !== "FLAT") {
      const lastQuoteAgeMs = 0 // Just fetched
      const cageDecision = theCage.evaluate({
        proposal,
        portfolio,
        config: DEFAULT_RISK_CONFIG,
        currentPrice: quote.spot,
        lastQuoteAgeMs
      })

      await safeDb(() =>
        prisma.riskEvaluation.create({
          data: {
            agentRunId: agentRun?.id ?? "no-db",
            approved: cageDecision.approved,
            reasons: cageDecision.reasons,
            sizedOrder: cageDecision.sizedOrder ?? undefined
          }
        })
      )

      if (cageDecision.approved && cageDecision.sizedOrder) {
        // Check HITL triggers
        const redis = getRedisClient()
        const hitlService = new HITLApprovalService(redis)
        const hitlTrigger = evaluateHITLTriggers(
          proposal,
          portfolio,
          cageDecision.sizedOrder.volume,
          quote.spot
        )

        if (hitlTrigger.required) {
          phase = "HITL"
          const requestId = await hitlService.requestApproval({
            requestId: crypto.randomUUID(),
            threadId,
            symbol,
            side: cageDecision.sizedOrder.side,
            confidence: proposal.confidence,
            rationale: proposal.rationale,
            agentVotes: proposal.agentVotes,
            riskSummary: cageDecision.reasons.join("; "),
            triggerReasons: hitlTrigger.reasons,
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            createdAt: new Date().toISOString()
          })

          // Wait for human decision (non-blocking in dev — 30s timeout)
          const timeoutMs = process.env.NODE_ENV === "production" ? 3_600_000 : 30_000
          const decision = await hitlService.awaitDecision(requestId, timeoutMs)
          hitlDecision = decision

          if (decision !== "APPROVED") {
            await agentRun && safeDb(() => prisma.agentRun.update({
              where: { id: agentRun!.id },
              data: { status: "COMPLETED", completedAt: new Date() }
            }))
            return {
              symbol,
              phase: "HITL_REJECTED",
              proposal: { side: proposal.side, confidence: proposal.confidence, rationale: proposal.rationale },
              riskDecision: { approved: true, reasons: cageDecision.reasons },
              hitlDecision: decision,
              durationMs: Date.now() - start
            }
          }
        }

        // ─── EXECUTE ────────────────────────────────────────────────────────────
        phase = "EXECUTE"
        if (config.liveExecution) {
          const result = await broker.executeOrder(
            cageDecision.sizedOrder,
            agentRun ? `opar-${agentRun.id}` : `opar-${Date.now()}`
          )
          executionResult = { status: result.status, dealId: result.dealId }

          if (result.status === "FILLED") {
            await safeDb(() =>
              prisma.order.create({
                data: {
                  agentRunId: agentRun?.id ?? "no-db",
                  symbol: cageDecision.sizedOrder!.symbol,
                  side: cageDecision.sizedOrder!.side,
                  volume: cageDecision.sizedOrder!.volume,
                  stopLoss: cageDecision.sizedOrder!.stopLoss,
                  takeProfit: cageDecision.sizedOrder!.takeProfit,
                  status: result.status,
                  dealId: result.dealId,
                  filledPrice: result.filledPrice
                }
              })
            )

            // ─── REFLECT ──────────────────────────────────────────────────────────
            phase = "REFLECT"
            await memory.episodic.recordTrade({
              symbol,
              side: cageDecision.sizedOrder.side,
              confidence: proposal.confidence,
              entryPrice: result.filledPrice ?? quote.spot,
              outcome: "PENDING",
              pnl: 0,
              rationale: proposal.rationale,
              agentVotes: proposal.agentVotes,
              at: new Date().toISOString()
            })
          }
        } else {
          // Paper mode
          executionResult = { status: "PAPER_FILLED", dealId: `PAPER-${Date.now()}` }
        }
      }
    }

    // Write explainability log
    await safeDb(() =>
      prisma.explainabilityLog.create({
        data: {
          symbol: proposal?.symbol ?? symbol,
          side: proposal?.side ?? "FLAT",
          confidence: proposal?.confidence ?? 0,
          rationale: proposal?.rationale ?? "No actionable proposal",
          agentVotes: (proposal?.agentVotes ?? []) as object,
          riskDecision: graphState.risk_decision as object,
          executionDetails: (executionResult as object) ?? undefined
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

    return {
      symbol,
      phase: "COMPLETE",
      proposal: proposal
        ? { side: proposal.side, confidence: proposal.confidence, rationale: proposal.rationale }
        : null,
      riskDecision: graphState.risk_decision
        ? { approved: graphState.risk_decision.approved, reasons: graphState.risk_decision.reasons }
        : null,
      executionResult,
      hitlDecision,
      durationMs: Date.now() - start
    }
  } catch (err) {
    const errorMsg = String(err)
    console.error(`[opar] Error in ${phase} phase for ${symbol}:`, err)
    await safeDb(() =>
      prisma.auditLog.create({
        data: { action: "OPAR_CYCLE_FAILED", details: JSON.stringify({ symbol, phase, error: errorMsg }) }
      })
    )
    return { symbol, phase, durationMs: Date.now() - start, error: errorMsg }
  }
}

/**
 * Full OPAR loop — processes all watchlist symbols sequentially.
 */
export async function runOPARLoop(config: OPARLoopConfig): Promise<OPARCycleResult[]> {
  console.log(`[opar] Starting OPAR loop — watchlist: ${config.watchlist.join(", ")}`)
  console.log(`[opar] Live execution: ${config.liveExecution}`)

  const broker = CapitalBroker.fromEnv()
  const accounts = await broker.getAccounts()
  const openPositions = await broker.getOpenPositions()
  const primaryAccount = accounts[0]

  const portfolio: PortfolioState = {
    accountBalance: primaryAccount?.balance ?? 100_000,
    availableMargin: primaryAccount?.available ?? 80_000,
    dailyPnl: primaryAccount?.profitLoss ?? 0,
    openPositions,
    consecutiveLosses: 0,
    dataStale: false
  }

  const results: OPARCycleResult[] = []

  for (const symbol of config.watchlist) {
    const result = await runOPARCycle(symbol, broker, portfolio, config)
    results.push(result)
    console.log(
      `[opar] ${symbol}: ${result.proposal?.side ?? "FLAT"} (${result.proposal?.confidence?.toFixed(2) ?? "0.00"}) — ${result.phase} [${result.durationMs}ms]`
    )
  }

  console.log("[opar] Loop complete")
  return results
}

async function safeDb<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn()
  } catch {
    console.warn("[opar] Database unavailable — skipping persistence")
    return null
  }
}
