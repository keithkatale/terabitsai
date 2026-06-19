import { prisma } from "@quant/db";
import { persistOpportunity, persistPulse } from "../persist.js";
import { HOT_SYMBOLS } from "../symbols.js";

export async function rankOpportunities(scanRunId: string): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.marketSignal.findMany({
    where: { createdAt: { gte: since }, action: { in: ["BUY", "SELL"] } },
    select: { symbol: true }
  });

  const counts = new Map<string, number>();
  for (const r of recent) {
    counts.set(r.symbol, (counts.get(r.symbol) ?? 0) + 1);
  }
  const topSignals = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([symbol]) => ({ symbol }));

  for (const row of topSignals) {
    const signals = await prisma.marketSignal.findMany({
      where: { symbol: row.symbol, createdAt: { gte: since } },
      take: 3,
      orderBy: { createdAt: "desc" }
    });
    const buyCount = signals.filter((s) => s.action === "BUY").length;
    const action = buyCount >= 2 ? "BUY" : "WATCH";
    await persistOpportunity({
      title: `${row.symbol} multi-strategy confluence`,
      thesis: `${signals.length} active signals across SMC, indicators, and news. Consensus bias: ${action}.`,
      symbols: [row.symbol],
      horizon: "swing",
      conviction: Math.min(5, signals.length + 2),
      style: "thematic",
      sector: signals[0]?.sector ?? undefined,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      scanRunId,
      payload: { signalIds: signals.map((s) => s.id) }
    });
  }
}

export async function buildPulseSnapshot(scanRunId: string): Promise<void> {
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const recent = await prisma.marketSignal.findMany({
    where: { createdAt: { gte: since } },
    take: 200
  });
  const buys = recent.filter((s) => s.action === "BUY").length;
  const sells = recent.filter((s) => s.action === "SELL").length;
  const risk = buys > sells * 1.5 ? "Risk-On" : sells > buys * 1.5 ? "Risk-Off" : "Neutral";
  const vol = recent.length > 50 ? "Elevated" : "Normal";

  await persistPulse(
    [
      { label: "Risk Appetite", value: risk },
      { label: "Signal Vol", value: vol },
      { label: "USD Bias", value: "Mixed" },
      { label: "Rates", value: "Data-dependent" }
    ],
    scanRunId
  );
}

export async function runSectorScan(): Promise<void> {
  const run = await prisma.intelScanRun.create({
    data: { scanType: "sector", status: "RUNNING" }
  });
  try {
    await rankOpportunities(run.id);
    await buildPulseSnapshot(run.id);
    await prisma.intelScanRun.update({
      where: { id: run.id },
      data: { status: "COMPLETED", completedAt: new Date(), symbolsScanned: HOT_SYMBOLS.length }
    });
  } catch (err) {
    await prisma.intelScanRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
        completedAt: new Date()
      }
    });
  }
}

