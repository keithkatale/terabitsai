import assert from "node:assert"
import {
  DEFAULT_RISK_CONFIG,
  type PortfolioState,
  type RiskConfig,
  type TradeProposal
} from "@quant/contracts"
import { evaluateRisk } from "./gatekeeper.js"

console.log("=== Running Risk Gatekeeper Unit Tests ===")

const basePortfolio: PortfolioState = {
  accountBalance: 100_000,
  availableMargin: 80_000,
  dailyPnl: 0,
  openPositions: [],
  consecutiveLosses: 0,
  dataStale: false
}

const baseProposal: TradeProposal = {
  symbol: "US100",
  side: "BUY",
  confidence: 0.75,
  timeHorizon: "swing",
  rationale: "Bullish momentum with macro tailwind",
  agentVotes: [
    { agent: "macro", side: "BUY", confidence: 0.7, note: "Risk-on" },
    { agent: "technical", side: "BUY", confidence: 0.8, note: "Breakout" }
  ],
  suggestedStopPct: 0.01,
  suggestedSizeHint: 5
}

function testApprovesValidProposal() {
  const decision = evaluateRisk({
    proposal: baseProposal,
    portfolio: basePortfolio,
    config: DEFAULT_RISK_CONFIG,
    currentPrice: 20_000
  })
  assert.strictEqual(decision.approved, true)
  assert.ok(decision.sizedOrder)
  assert.strictEqual(decision.sizedOrder!.symbol, "US100")
  assert.strictEqual(decision.sizedOrder!.side, "BUY")
  assert.ok(decision.sizedOrder!.volume > 0)
  assert.ok(decision.sizedOrder!.stopLoss < 20_000)
  assert.ok(decision.sizedOrder!.takeProfit > 20_000)
  console.log("✓ Approves valid proposal")
}

function testRejectsKillSwitch() {
  const config: RiskConfig = { ...DEFAULT_RISK_CONFIG, killSwitchActive: true }
  const decision = evaluateRisk({
    proposal: baseProposal,
    portfolio: basePortfolio,
    config,
    currentPrice: 20_000
  })
  assert.strictEqual(decision.approved, false)
  assert.ok(decision.reasons[0].includes("Kill switch"))
  console.log("✓ Rejects when kill switch active")
}

function testRejectsStaleData() {
  const decision = evaluateRisk({
    proposal: baseProposal,
    portfolio: { ...basePortfolio, dataStale: true },
    config: DEFAULT_RISK_CONFIG,
    currentPrice: 20_000
  })
  assert.strictEqual(decision.approved, false)
  assert.ok(decision.reasons[0].includes("stale"))
  console.log("✓ Rejects stale market data")
}

function testRejectsFlatProposal() {
  const decision = evaluateRisk({
    proposal: { ...baseProposal, side: "FLAT" },
    portfolio: basePortfolio,
    config: DEFAULT_RISK_CONFIG,
    currentPrice: 20_000
  })
  assert.strictEqual(decision.approved, false)
  console.log("✓ Rejects FLAT proposals")
}

function testRejectsDailyLossLimit() {
  const decision = evaluateRisk({
    proposal: baseProposal,
    portfolio: { ...basePortfolio, dailyPnl: -3_500 },
    config: DEFAULT_RISK_CONFIG,
    currentPrice: 20_000
  })
  assert.strictEqual(decision.approved, false)
  assert.ok(decision.reasons.some((r) => r.includes("Daily loss")))
  console.log("✓ Rejects when daily loss limit breached")
}

function testRejectsConsecutiveLosses() {
  const config: RiskConfig = { ...DEFAULT_RISK_CONFIG, maxConsecutiveLosses: 3 }
  const decision = evaluateRisk({
    proposal: baseProposal,
    portfolio: { ...basePortfolio, consecutiveLosses: 3 },
    config,
    currentPrice: 20_000
  })
  assert.strictEqual(decision.approved, false)
  assert.ok(decision.reasons.some((r) => r.includes("Circuit breaker")))
  console.log("✓ Rejects on consecutive loss circuit breaker")
}

function testRejectsDuplicateSymbolSide() {
  const decision = evaluateRisk({
    proposal: baseProposal,
    portfolio: {
      ...basePortfolio,
      openPositions: [
        {
          symbol: "US100",
          side: "BUY",
          volume: 1,
          entryPrice: 19_500,
          unrealizedPnl: 500
        }
      ]
    },
    config: DEFAULT_RISK_CONFIG,
    currentPrice: 20_000
  })
  assert.strictEqual(decision.approved, false)
  assert.ok(decision.reasons.some((r) => r.includes("Already holding")))
  console.log("✓ Rejects duplicate same-side position on symbol")
}

function testEnforcesMinStopPct() {
  const decision = evaluateRisk({
    proposal: { ...baseProposal, suggestedStopPct: 0.001 },
    portfolio: basePortfolio,
    config: { ...DEFAULT_RISK_CONFIG, minStopPct: 0.01 },
    currentPrice: 20_000
  })
  assert.strictEqual(decision.approved, true)
  const stopDistance = 20_000 - decision.sizedOrder!.stopLoss
  assert.ok(stopDistance >= 20_000 * 0.009, "Stop should respect minStopPct")
  console.log("✓ Enforces minimum stop percentage")
}

function testCapsPositionSize() {
  const config: RiskConfig = {
    ...DEFAULT_RISK_CONFIG,
    maxPositionSizePct: 0.01,
    maxRiskPerTradePct: 0.5
  }
  const decision = evaluateRisk({
    proposal: { ...baseProposal, suggestedSizeHint: 100 },
    portfolio: basePortfolio,
    config,
    currentPrice: 20_000
  })
  assert.strictEqual(decision.approved, true)
  const positionValue = decision.sizedOrder!.volume * 20_000
  assert.ok(positionValue <= 100_000 * 0.01 + 1, "Position should be capped at 1% of account")
  console.log("✓ Caps position size to maxPositionSizePct")
}

function testRejectsLowConfidence() {
  const decision = evaluateRisk({
    proposal: { ...baseProposal, confidence: 0.1 },
    portfolio: basePortfolio,
    config: DEFAULT_RISK_CONFIG,
    currentPrice: 20_000
  })
  assert.strictEqual(decision.approved, false)
  assert.ok(decision.reasons.some((r) => r.includes("Confidence")))
  console.log("✓ Rejects low-confidence proposals")
}

function testRejectsMaxOpenPositions() {
  const positions = Array.from({ length: 10 }, (_, i) => ({
    symbol: `SYM${i}`,
    side: "BUY" as const,
    volume: 0.1,
    entryPrice: 100,
    unrealizedPnl: 0
  }))
  const decision = evaluateRisk({
    proposal: baseProposal,
    portfolio: { ...basePortfolio, openPositions: positions },
    config: DEFAULT_RISK_CONFIG,
    currentPrice: 20_000
  })
  assert.strictEqual(decision.approved, false)
  assert.ok(decision.reasons.some((r) => r.includes("Max open positions")))
  console.log("✓ Rejects when max open positions reached")
}

testApprovesValidProposal()
testRejectsKillSwitch()
testRejectsStaleData()
testRejectsFlatProposal()
testRejectsDailyLossLimit()
testRejectsConsecutiveLosses()
testRejectsDuplicateSymbolSide()
testEnforcesMinStopPct()
testCapsPositionSize()
testRejectsLowConfidence()
testRejectsMaxOpenPositions()

console.log("\n=== All Risk Gatekeeper Tests Passed ===")
