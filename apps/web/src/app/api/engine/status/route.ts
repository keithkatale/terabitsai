import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Engine heartbeat for the app shell. Uses intel scan runs only —
 * agent_runs (OPAR automation) is not migrated on this Supabase project.
 */
export async function GET() {
  try {
    const { prisma } = await import("@quant/db");

    const latestScan = await prisma.intelScanRun.findFirst({
      orderBy: { startedAt: "desc" },
    });

    const mode: "idle" | "running" | "scanning" =
      latestScan?.status === "RUNNING" ? "scanning" : "idle";

    return NextResponse.json({
      mode,
      lastOparCycleAt: null,
      lastIntelScanAt: latestScan?.startedAt.toISOString() ?? null,
      watchlist: [],
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
