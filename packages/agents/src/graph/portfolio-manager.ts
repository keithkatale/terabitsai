import { StateGraph, END } from "@langchain/langgraph"
import { MemorySaver } from "@langchain/langgraph"
import { PortfolioStateAnnotation, type PortfolioState, type MarketContext } from "./state.js"
import {
  gatherContextNode,
  intelligenceAgentNode,
  quantAgentNode,
  riskCriticNode,
  aggregateProposalsNode
} from "./nodes.js"
import {
  routeAfterAggregation,
  routeAfterRisk,
  routeAfterHITL
} from "./edges.js"
import { evaluateRisk } from "@quant/risk"
import type { PortfolioState as RiskPortfolioState, RiskConfig } from "@quant/contracts"
import { DEFAULT_RISK_CONFIG } from "@quant/contracts"

/**
 * Risk gatekeeper node — pure deterministic, no LLM.
 */
async function riskGatekeeperNode(state: PortfolioState): Promise<Partial<PortfolioState>> {
  const proposal = state.trade_proposal
  const ctx = state.market_context

  if (!proposal || !ctx) {
    return { risk_decision: { approved: false, reasons: ["Missing proposal or market context"] } }
  }

  const portfolio: RiskPortfolioState = {
    accountBalance: 100_000,
    availableMargin: 80_000,
    dailyPnl: 0,
    openPositions: [],
    consecutiveLosses: 0,
    dataStale: false
  }

  const decision = evaluateRisk({
    proposal,
    portfolio,
    config: DEFAULT_RISK_CONFIG,
    currentPrice: ctx.currentPrice
  })

  return { risk_decision: decision }
}

/**
 * HITL checkpoint node — pauses graph and waits for external approval signal.
 * In this implementation the graph suspends; the caller is expected to resume
 * it with hitl_pending cleared when the user approves.
 */
async function hitlCheckpointNode(state: PortfolioState): Promise<Partial<PortfolioState>> {
  if (!state.hitl_pending) return {}
  // Graph is interrupted here — external system must call graph.invoke() again
  // with hitl_pending: null to proceed to execution
  console.log(`[hitl] Awaiting approval for request ${state.hitl_pending.requestId}: ${state.hitl_pending.reason}`)
  return {}
}

/**
 * Skip / end node — called when trade is rejected or FLAT.
 */
async function skipNode(state: PortfolioState): Promise<Partial<PortfolioState>> {
  const reason = state.risk_decision?.reasons?.join(", ") ?? state.error ?? "No actionable proposal"
  console.log(`[portfolio-manager] Skipping execution: ${reason}`)
  return {}
}

/**
 * Execution stub node — actual broker call happens in the engine loop;
 * this node signals readiness and logs.
 */
async function executeNode(state: PortfolioState): Promise<Partial<PortfolioState>> {
  const decision = state.risk_decision
  if (!decision?.approved || !decision.sizedOrder) {
    return { error: "Execute node reached without approved order" }
  }
  console.log(`[portfolio-manager] Order ready for execution: ${JSON.stringify(decision.sizedOrder)}`)
  return {}
}

/**
 * Build and compile the Portfolio Manager graph.
 * The checkpointer enables HITL interrupts and state persistence.
 */
export function buildPortfolioManagerGraph(checkpointer?: MemorySaver) {
  const cp = checkpointer ?? new MemorySaver()

  const graph = new StateGraph(PortfolioStateAnnotation)
    .addNode("gather_context", gatherContextNode)
    .addNode("intelligence_agent", intelligenceAgentNode)
    .addNode("quant_agent", quantAgentNode)
    .addNode("risk_critic", riskCriticNode)
    .addNode("aggregate_proposals", aggregateProposalsNode)
    .addNode("risk_gatekeeper", riskGatekeeperNode)
    .addNode("hitl_checkpoint", hitlCheckpointNode)
    .addNode("execute", executeNode)
    .addNode("skip", skipNode)

    // Entry: enrich context first
    .addEdge("__start__", "gather_context")

    // After context enrichment: run intelligence and quant agents in parallel
    .addEdge("gather_context", "intelligence_agent")
    .addEdge("gather_context", "quant_agent")

    // After both specialists: run risk critic (needs their votes)
    .addEdge("intelligence_agent", "risk_critic")
    .addEdge("quant_agent", "risk_critic")

    // After risk critic: aggregate all votes
    .addEdge("risk_critic", "aggregate_proposals")

    // Route: skip if FLAT/error, else go to deterministic risk gate
    .addConditionalEdges("aggregate_proposals", routeAfterAggregation, {
      risk_gatekeeper: "risk_gatekeeper",
      skip: "skip"
    })

    // Route: HITL if flagged, execute if approved, skip if rejected
    .addConditionalEdges("risk_gatekeeper", routeAfterRisk, {
      hitl_checkpoint: "hitl_checkpoint",
      execute: "execute",
      skip: "skip"
    })

    // Route: execute after HITL approval, skip if rejected/timed out
    .addConditionalEdges("hitl_checkpoint", routeAfterHITL, {
      execute: "execute",
      skip: "skip"
    })

    .addEdge("execute", END)
    .addEdge("skip", END)

  return graph.compile({
    checkpointer: cp,
    interruptBefore: ["hitl_checkpoint"]
  })
}

export type PortfolioManagerGraph = ReturnType<typeof buildPortfolioManagerGraph>

/**
 * Convenience function: run the full portfolio manager graph for a single symbol.
 */
export async function runPortfolioManager(
  input: {
    symbol: string
    marketContext: MarketContext
    threadId?: string
  }
): Promise<PortfolioState> {
  const graph = buildPortfolioManagerGraph()
  const config = { configurable: { thread_id: input.threadId ?? crypto.randomUUID() } }

  const initialState: Partial<PortfolioState> = {
    symbol: input.symbol,
    market_context: input.marketContext,
    agent_votes: [],
    trade_proposal: null,
    risk_decision: null,
    hitl_pending: null,
    execution_result: null,
    error: null
  }

  const result = await graph.invoke(initialState, config)
  return result
}
