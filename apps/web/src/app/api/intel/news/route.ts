import { NextResponse } from "next/server";
import { prisma } from "@quant/db";
import { runNewsScan } from "@quant/market-intel";
import { fetchIntelFeed } from "@/lib/intel/feed";
import { fetchIntelDocuments, fetchSynthesisBriefs } from "@/lib/intel/synthesis";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const STALE_MS = 12 * 60 * 1000;
let scanInFlight: Promise<void> | null = null;

async function ensureFreshNews(): Promise<"scanning" | "ready" | "running"> {
  const since = new Date(Date.now() - STALE_MS);

  const [recentNews, runningScan] = await Promise.all([
    prisma.marketNewsItem.count({ where: { createdAt: { gte: since } } }),
    prisma.intelScanRun.findFirst({ where: { status: "RUNNING" }, orderBy: { startedAt: "desc" } }),
  ]);

  if (runningScan) return "running";
  if (recentNews >= 5) return "ready";

  if (!scanInFlight) {
    scanInFlight = runNewsScan()
      .catch((err) => console.error("[intel/news] background scan failed:", err))
      .finally(() => {
        scanInFlight = null;
      });
  }

  return "scanning";
}

export async function GET() {
  try {
    const status = await ensureFreshNews();

    const [items, documents, briefs, newsCount, lastScan] = await Promise.all([
      fetchIntelFeed({ limit: 60, tab: "news" }),
      fetchIntelDocuments({ limit: 25 }),
      fetchSynthesisBriefs({ limit: 8 }),
      prisma.marketNewsItem.count({
        where: { createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
      }),
      prisma.intelScanRun.findFirst({
        where: { status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
      }),
    ]);

    const aiItems = items.filter(
      (i) => i.kind === "news" && (i.item as { source?: string }).source === "ai-scout",
    );
    const sourceItems = items.filter(
      (i) => i.kind === "news" && (i.item as { source?: string }).source !== "ai-scout",
    );

    return NextResponse.json({
      success: true,
      status,
      counts: { news: newsCount, aiScout: aiItems.length, feedItems: items.length },
      lastScanAt: lastScan?.completedAt?.toISOString() ?? null,
      items,
      aiItems,
      sourceItems,
      documents,
      briefs,
    });
  } catch (err) {
    console.error("[intel/news]", err);
    return NextResponse.json(
      { success: false, status: "error", items: [], documents: [], briefs: [] },
      { status: 500 },
    );
  }
}
