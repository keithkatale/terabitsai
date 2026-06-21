import { NextResponse } from "next/server";
import type { AgentEvent } from "@/components/terminal/agent-activity-feed";

export const dynamic = "force-dynamic";

function mapExplainabilityToEvent(row: {
  id: string;
  symbol: string;
  side: string;
  confidence: number;
  rationale: string;
  agentVotes: unknown;
  riskDecision: unknown;
  executionDetails: unknown;
  createdAt: Date;
}): AgentEvent {
  const risk = row.riskDecision as { approved?: boolean; reasons?: string[] } | null;
  const exec = row.executionDetails as { status?: string } | null;
  const approved = risk?.approved;

  let agent: AgentEvent["agent"] = "portfolio_manager";
  let phase: AgentEvent["phase"] = "PLAN";

  if (exec?.status) {
    agent = "executor";
    phase = exec.status === "PAPER_FILLED" ? "COMPLETE" : "EXECUTE";
  } else if (risk) {
    agent = "cage";
    phase = approved ? "EXECUTE" : "ERROR";
  }

  return {
    id: row.id,
    timestamp: row.createdAt.toISOString(),
    agent,
    phase,
    symbol: row.symbol,
    message: row.rationale.slice(0, 240),
    side: row.side as AgentEvent["side"],
    confidence: row.confidence,
    metadata: {
      agentVotes: row.agentVotes,
      riskDecision: row.riskDecision,
      executionDetails: row.executionDetails,
    },
  };
}

export async function GET() {
  try {
    const { prisma } = await import("@quant/db");

    const logs = await prisma.explainabilityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(logs.map(mapExplainabilityToEvent));
  } catch (e) {
    console.error("[engine/activity]", e);
    return NextResponse.json([]);
  }
}
