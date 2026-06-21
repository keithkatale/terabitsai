import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { prisma } = await import("@quant/db");

    const [latestRun, latestScan, runningRuns] = await Promise.all([
      prisma.agentRun.findFirst({ orderBy: { startedAt: "desc" } }),
      prisma.intelScanRun.findFirst({ orderBy: { startedAt: "desc" } }),
      prisma.agentRun.count({ where: { status: "RUNNING" } }),
    ]);

    let mode: "idle" | "running" | "scanning" = "idle";
    if (runningRuns > 0) mode = "running";
    else if (latestScan?.status === "RUNNING") mode = "scanning";

    return NextResponse.json({
      mode,
      lastOparCycleAt: latestRun?.completedAt?.toISOString() ?? latestRun?.startedAt.toISOString() ?? null,
      lastIntelScanAt: latestScan?.startedAt.toISOString() ?? null,
      watchlist: latestRun ? [latestRun.symbol] : [],
      pendingHitl: 0,
    });
  } catch (e) {
    console.error("[engine/status]", e);
    return NextResponse.json({
      mode: "idle",
      lastOparCycleAt: null,
      lastIntelScanAt: null,
      watchlist: [],
      pendingHitl: 0,
    });
  }
}
