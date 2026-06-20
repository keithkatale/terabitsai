import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { prisma } = await import("@quant/db")

    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        agentRun: {
          include: {
            proposals: { take: 1 }
          }
        }
      }
    })

    const entries = orders.map((o) => {
      const proposal = o.agentRun?.proposals?.[0]
      return {
        id: o.id,
        symbol: o.symbol,
        side: o.side,
        volume: o.volume,
        entryPrice: o.filledPrice ?? 0,
        stopLoss: o.stopLoss ?? undefined,
        takeProfit: o.takeProfit ?? undefined,
        status: o.status,
        dealId: o.dealId ?? undefined,
        confidence: proposal?.confidence ?? 0,
        rationale: proposal?.rationale ?? "",
        agentVotes: (proposal?.payload as { agentVotes?: unknown[] } | null)?.agentVotes ?? [],
        createdAt: o.createdAt.toISOString(),
        filledAt: o.createdAt.toISOString()
      }
    })

    return NextResponse.json(entries)
  } catch {
    return NextResponse.json([])
  }
}
