// Legacy sequential orchestrator (kept for compatibility)
export { runOrchestrator, type OrchestratorInput, type OrchestratorResult } from "./orchestrator.js"
export {
  runMacroAgent,
  runTechnicalAgent,
  runAggregator,
  computeSimpleIndicators,
  type AgentContext
} from "./agents.js"

// LangGraph-based hierarchical multi-agent system
export { buildPortfolioManagerGraph, runPortfolioManager, type PortfolioManagerGraph } from "./graph/portfolio-manager.js"
export { PortfolioStateAnnotation, type PortfolioState, type MarketContext, type AgentVoteRecord, type HITLRequest, type MemorySnapshot } from "./graph/state.js"
export { gatherContextNode, intelligenceAgentNode, quantAgentNode, riskCriticNode, aggregateProposalsNode } from "./graph/nodes.js"
export { routeAfterAggregation, routeAfterRisk, routeAfterHITL } from "./graph/edges.js"
