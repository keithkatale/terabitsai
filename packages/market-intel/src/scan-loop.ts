import { rsi, ema } from "@quant/indicators";
import { fetchYahooFinanceNews } from "./ingest/yahoo-news.js";
import { fetchFinnhubNews } from "./ingest/finnhub-news.js";
import { fetchFinnhubNewsSentiment } from "./ingest/finnhub-extended.js";
import { fetchMarketauxNews } from "./ingest/marketaux-news.js";
import { fetchFmpInsiderTrades } from "./ingest/fmp-data.js";
import { fetchCandles, fetchQuote } from "./ingest/capital-market.js";
import { runSmcStrategy } from "./strategies/smc-strategy.js";
import { runIndicatorStrategy } from "./strategies/indicator-strategy.js";
import { normalizeNews, newsToSignals } from "./strategies/news-sentiment.js";
import {
  normalizeFinnhubNews,
  normalizeMarketauxArticle,
  normalizeFmpInsider,
  type NormalizedIntelDoc
} from "./enrich/normalizer.js";
import {
  completeScanRun,
  createScanRun,
  persistAssetAnalysis,
  persistNewsItem,
  persistSignal
} from "./persist.js";
import { persistIntelDocument } from "./persist-synthesis.js";
import { synthesizeCatalystBrief } from "./synthesize/catalyst-brief.js";
import { synthesizeFlowBrief, synthesizeEarningsBrief } from "./synthesize/fundamental-brief.js";
import { detectContradictions } from "./synthesize/contradiction.js";
import { buildEntityGraphForSymbol } from "./graph/ripple-builder.js";
import { recordAnalog } from "./analyze/analog-matcher.js";
import { assetClassForSymbol, sectorForSymbol } from "./symbols.js";
import type { IntelScanType } from "@quant/contracts";

function expiresForStrategy(strategy: string): Date {
  const h = strategy.includes("NEWS") ? 24 : strategy.includes("SMC") ? 6 : 12;
  return new Date(Date.now() + h * 60 * 60 * 1000);
}

async function ingestSymbolDocuments(
  symbol: string,
  scanRunId: string
): Promise<NormalizedIntelDoc[]> {
  const docs: NormalizedIntelDoc[] = [];

  const [yahoo, finnhub, finnhubSent, marketaux, insiders] = await Promise.all([
    fetchYahooFinanceNews(symbol),
    fetchFinnhubNews(symbol),
    fetchFinnhubNewsSentiment(symbol),
    fetchMarketauxNews({ symbols: [symbol], limit: 5 }),
    fetchFmpInsiderTrades(symbol)
  ]);

  const headlines = normalizeNews(symbol, yahoo, finnhub);
  for (const h of headlines) {
    await persistNewsItem({
      symbol,
      headline: h.headline,
      summary: h.summary,
      sentiment: h.sentiment,
      source: h.source,
      url: h.url,
      category: "symbol",
      publishedAt: h.publishedAt,
      scanRunId
    });
  }

  const finnhubArticles = (finnhubSent.articles ?? []).map((a) => ({
    headline: a.headline,
    summary: a.summary,
    source: a.source,
    url: a.url,
    publishedAt: a.datetime ? new Date(a.datetime * 1000) : undefined,
    sentiment:
      finnhubSent.sentiment ?
        (finnhubSent.sentiment.bullishPercent ?? 50) / 100 - 0.5
      : undefined,
    id: String(a.id ?? a.headline)
  }));

  const normalized = [
    ...normalizeFinnhubNews(symbol, finnhubArticles),
    ...marketaux.map(normalizeMarketauxArticle),
    ...insiders.slice(0, 5).map((row) =>
      normalizeFmpInsider({
        symbol,
        transactionType: String(row.transactionType ?? ""),
        securitiesTransacted: Number(row.securitiesTransacted) || 0,
        price: Number(row.price) || 0,
        reportingName: String(row.reportingName ?? ""),
        transactionDate: String(row.transactionDate ?? "")
      })
    )
  ];

  for (const doc of normalized) {
    const id = await persistIntelDocument(doc, scanRunId);
    if (id) docs.push(doc);
  }

  return docs;
}

export async function scanSymbol(symbol: string, scanRunId: string): Promise<number> {
  let created = 0;
  const sector = sectorForSymbol(symbol);
  const assetClass = assetClassForSymbol(symbol);

  const [quote, candles, intelDocs] = await Promise.all([
    fetchQuote(symbol),
    fetchCandles(symbol, "HOUR", 120),
    ingestSymbolDocuments(symbol, scanRunId)
  ]);

  const headlines = intelDocs.filter((d) => d.diet === "catalyst");
  const newsSignals = newsToSignals(
    headlines.map((h) => ({
      headline: h.title,
      summary: h.body,
      source: h.source,
      url: h.url,
      publishedAt: h.publishedAt,
      sentiment: (h.sentiment ?? 0) > 0.1 ? "bullish" as const : (h.sentiment ?? 0) < -0.1 ? "bearish" as const : "neutral" as const
    }))
  );

  for (const ns of newsSignals) {
    const row = await persistSignal({
      symbol,
      strategy: ns.strategy,
      action: ns.action,
      timeframe: ns.timeframe,
      confidence: ns.confidence,
      reason: ns.reason,
      source: "news",
      sector,
      assetClass,
      expiresAt: expiresForStrategy(ns.strategy),
      scanRunId,
      payload: { headline: ns.headline.headline, sentiment: ns.headline.sentiment }
    });
    if (row) created++;
  }

  const smcSignals = runSmcStrategy(candles);
  const indicatorSignals = runIndicatorStrategy(candles);
  for (const sig of [...smcSignals, ...indicatorSignals]) {
    const row = await persistSignal({
      symbol,
      strategy: sig.strategy,
      action: sig.action,
      timeframe: sig.timeframe,
      confidence: sig.confidence,
      reason: sig.reason,
      source: "deterministic",
      sector,
      assetClass,
      expiresAt: expiresForStrategy(sig.strategy),
      scanRunId,
      payload: { ...sig.payload, quote: quote ?? undefined }
    });
    if (row) created++;
  }

  if (headlines.length > 0) {
    const brief = await synthesizeCatalystBrief({
      symbol,
      documents: headlines,
      change24h: quote?.change24hPct ?? undefined,
      scanRunId
    });
    if (brief) created++;

    await recordAnalog({
      symbol,
      eventSummary: brief?.headline ?? headlines[0].title,
      synthesisId: brief?.id,
      return1d: quote?.change24hPct ?? undefined
    }).catch(() => {});
  }

  const flowDocs = intelDocs.filter((d) => d.diet === "flow");
  if (flowDocs.length > 0) {
    await synthesizeFlowBrief(
      symbol,
      flowDocs.map((d) => ({ title: d.title, body: d.body, sentiment: d.sentiment })),
      scanRunId
    );
    created++;
  }

  await detectContradictions(symbol, scanRunId).catch(() => {});
  await buildEntityGraphForSymbol(symbol).catch(() => {});

  if (candles.length > 0) {
    const closes = candles.map((c) => c.c);
    const rsiVal = rsi(closes, 14);
    const ema20 = ema(closes, 20).at(-1);
    const ema50 = ema(closes, 50).at(-1);
    const bullish = newsSignals.filter((n) => n.action === "BUY").length > newsSignals.filter((n) => n.action === "SELL").length;
    await persistAssetAnalysis({
      symbol,
      price: quote?.spot ?? closes.at(-1),
      changePct: quote?.change24hPct ?? undefined,
      rsi: rsiVal ?? undefined,
      ema20,
      ema50,
      smcStructure: smcSignals.length ? { signals: smcSignals.length } : undefined,
      sentimentRating: bullish ? "BULLISH" : "NEUTRAL",
      sentimentScore: bullish ? 0.3 : 0,
      newsTeasers: headlines.slice(0, 3).map((h) => ({ title: h.title, source: h.source }))
    });
  }

  return created;
}

export async function runColdSymbolScan(symbol: string, scanRunId: string): Promise<void> {
  await synthesizeEarningsBrief(symbol, scanRunId).catch(() => {});
  await ingestSymbolDocuments(symbol, scanRunId);
}

export async function runScan(symbols: string[], scanType: IntelScanType): Promise<void> {
  const run = await createScanRun(scanType);
  let signalsCreated = 0;
  let error: string | undefined;

  try {
    for (const sym of symbols) {
      try {
        signalsCreated += await scanSymbol(sym, run.id);
      } catch (err) {
        console.warn(`[intel] Symbol scan failed for ${sym}:`, err);
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  await completeScanRun(run.id, {
    symbolsScanned: symbols.length,
    signalsCreated,
    error
  });

  console.log(`[intel] ${scanType} scan complete: ${symbols.length} symbols, ${signalsCreated} signals`);
}
