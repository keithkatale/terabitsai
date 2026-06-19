import { prisma, Prisma } from "@quant/db";
import type { IntelScanType } from "@quant/contracts";

const DEDUP_TTL_MS = 60 * 60 * 1000;

export async function createScanRun(scanType: IntelScanType) {
  return prisma.intelScanRun.create({
    data: { scanType, status: "RUNNING" }
  });
}

export async function completeScanRun(
  id: string,
  data: { symbolsScanned: number; signalsCreated: number; error?: string }
) {
  return prisma.intelScanRun.update({
    where: { id },
    data: {
      status: data.error ? "FAILED" : "COMPLETED",
      symbolsScanned: data.symbolsScanned,
      signalsCreated: data.signalsCreated,
      error: data.error ?? null,
      completedAt: new Date()
    }
  });
}

export async function shouldSkipSignal(
  symbol: string,
  strategy: string,
  action: string
): Promise<boolean> {
  const since = new Date(Date.now() - DEDUP_TTL_MS);
  const existing = await prisma.marketSignal.findFirst({
    where: { symbol, strategy, action, createdAt: { gte: since } }
  });
  return Boolean(existing);
}

export async function persistSignal(input: {
  symbol: string;
  strategy: string;
  action: string;
  timeframe: string;
  confidence: number;
  reason: string;
  source: string;
  payload?: Record<string, unknown>;
  sector?: string;
  assetClass?: string;
  expiresAt?: Date;
  scanRunId: string;
}) {
  if (await shouldSkipSignal(input.symbol, input.strategy, input.action)) return null;
  return prisma.marketSignal.create({
    data: {
      symbol: input.symbol,
      strategy: input.strategy,
      action: input.action,
      timeframe: input.timeframe,
      confidence: input.confidence,
      reason: input.reason,
      source: input.source,
      payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined,
      sector: input.sector,
      assetClass: input.assetClass,
      expiresAt: input.expiresAt,
      scanRunId: input.scanRunId
    }
  });
}

export async function persistNewsItem(input: {
  symbol?: string;
  headline: string;
  summary: string;
  sentiment: string;
  source: string;
  url?: string;
  category?: string;
  publishedAt?: Date;
  scanRunId: string;
}) {
  const dup = await prisma.marketNewsItem.findFirst({
    where: {
      headline: input.headline,
      symbol: input.symbol ?? null,
      createdAt: { gte: new Date(Date.now() - DEDUP_TTL_MS) }
    }
  });
  if (dup) return null;
  return prisma.marketNewsItem.create({ data: { ...input, symbol: input.symbol ?? null } });
}

export async function persistAssetAnalysis(input: {
  symbol: string;
  price?: number;
  changePct?: number;
  rsi?: number;
  ema20?: number;
  ema50?: number;
  smcStructure?: Record<string, unknown>;
  sentimentRating: string;
  sentimentScore: number;
  newsTeasers?: unknown[];
}) {
  return prisma.assetAnalysis.create({
    data: {
      symbol: input.symbol,
      timeframe: "1h",
      price: input.price,
      changePct: input.changePct,
      rsi: input.rsi,
      ema20: input.ema20,
      ema50: input.ema50,
      smcStructure: (input.smcStructure ?? undefined) as Prisma.InputJsonValue | undefined,
      sentimentRating: input.sentimentRating,
      sentimentScore: input.sentimentScore,
      newsTeasers: (input.newsTeasers ?? undefined) as Prisma.InputJsonValue | undefined
    }
  });
}

export async function persistOpportunity(input: {
  title: string;
  thesis: string;
  symbols: string[];
  horizon: string;
  conviction: number;
  style: string;
  sector?: string;
  payload?: Record<string, unknown>;
  expiresAt?: Date;
  scanRunId: string;
}) {
  return prisma.investOpportunity.create({
    data: {
      ...input,
      payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined
    }
  });
}

export async function persistPulse(themes: Array<{ label: string; value: string }>, scanRunId: string) {
  return prisma.marketPulseSnapshot.create({
    data: { themes: themes as Prisma.InputJsonValue, scanRunId }
  });
}
