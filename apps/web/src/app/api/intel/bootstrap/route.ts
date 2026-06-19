import { NextResponse } from "next/server";
import { prisma } from "@quant/db";
import { runScan, HOT_SYMBOLS } from "@quant/market-intel";
import { fetchIntelFeed } from "@/lib/intel/feed";
import { fetchCatalystRadar, fetchSynthesisBriefs } from "@/lib/intel/synthesis";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const STALE_MS = 20 * 60 * 1000;
let scanInFlight: Promise<void> | null = null;

async function ensureFreshScan(): Promise<"scanning" | "ready" | "running"> {
  const since = new Date(Date.now() - STALE_MS);

  const [recentSignals, runningScan, recentScan] = await Promise.all([
    prisma.marketSignal.count({ where: { createdAt: { gte: since } } }),
    prisma.intelScanRun.findFirst({ where: { status: "RUNNING" }, orderBy: { startedAt: "desc" } }),
    prisma.intelScanRun.findFirst({ where: { status: "COMPLETED" }, orderBy: { completedAt: "desc" } }),
  ]);

  if (runningScan) return "running";
  if (recentSignals >= 3) return "ready";

  const lastCompletedAt = recentScan?.completedAt?.getTime() ?? 0;
  if (Date.now() - lastCompletedAt < 60_000 && recentSignals > 0) return "ready";

  if (!scanInFlight) {
    scanInFlight = runScan([...HOT_SYMBOLS], "hot")
      .catch((err) => console.error("[intel/bootstrap] hot scan failed:", err))
      .finally(() => {
        scanInFlight = null;
      });
  }

  return "scanning";
}

export async function GET() {
  try {
    const status = await ensureFreshScan();

    const [items, radar, briefs, signalCount, newsCount] = await Promise.all([
      fetchIntelFeed({ limit: 40 }),
      fetchCatalystRadar([...HOT_SYMBOLS]),
      fetchSynthesisBriefs({ limit: 12 }),
      prisma.marketSignal.count({ where: { createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } } }),
      prisma.marketNewsItem.count({ where: { createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } } }),
    ]);

    return NextResponse.json({
      success: true,
      status,
      counts: { signals: signalCount, news: newsCount, feedItems: items.length, radar: radar.length, briefs: briefs.length },
      items,
      radar,
      briefs,
    });
  } catch (err) {
    console.error("[intel/bootstrap]", err);
    return NextResponse.json({ success: false, status: "error", items: [], radar: [], briefs: [] }, { status: 500 });
  }
}
