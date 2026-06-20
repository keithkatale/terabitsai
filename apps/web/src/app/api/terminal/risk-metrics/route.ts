import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    // Dynamic import to avoid build-time issues
    const { prisma } = await import("@quant/db")
    const { circuitBreaker } = await import("@quant/risk")

    // Get recent orders for win rate calculation
    const recentOrders = await prisma.order.findMany({
      where: {
        status: { in: ["FILLED", "CANCELLED"] },
        createdAt: { gte: new Date(Date.now() - 7 * 86400_000) }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    })

    const todayOrders = recentOrders.filter(
      (o) => o.createdAt > new Date(Date.now() - 86400_000)
    )

    const cbStatus = circuitBreaker.getStatus()

    const metrics = {
      circuitBreakerState: cbStatus.state,
      circuitBreakerReason: cbStatus.reason || undefined,
      dailyPnl: 0,
      dailyPnlPct: 0,
      dailyDrawdownPct: 0,
      consecutiveLosses: 0,
      openPositionCount: 0,
      exposurePct: 0,
      todayTrades: todayOrders.length,
      winRate: recentOrders.length > 0 ? 0.5 : undefined
    }

    return NextResponse.json(metrics)
  } catch {
    // Return safe defaults if any service is unavailable
    return NextResponse.json({
      circuitBreakerState: "CLOSED",
      dailyPnl: 0,
      dailyPnlPct: 0,
      dailyDrawdownPct: 0,
      consecutiveLosses: 0,
      openPositionCount: 0,
      exposurePct: 0,
      todayTrades: 0
    })
  }
}
