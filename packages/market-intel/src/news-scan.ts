import { fetchYahooFinanceNews } from "./ingest/yahoo-news.js";
import { fetchFinnhubNews } from "./ingest/finnhub-news.js";
import { fetchMacroNewsBundle, type GeneralHeadline } from "./ingest/general-news.js";
import { normalizeNews } from "./strategies/news-sentiment.js";
import {
  normalizeFinnhubNews,
  type NormalizedIntelDoc,
} from "./enrich/normalizer.js";
import { createScanRun, completeScanRun, persistNewsItem } from "./persist.js";
import { persistIntelDocument } from "./persist-synthesis.js";
import { synthesizeMorningBrief } from "./synthesize/catalyst-brief.js";
import { runAiNewsScout } from "./scout/ai-news-scout.js";
import { HOT_SYMBOLS } from "./symbols.js";

function headlineToIntelDoc(h: GeneralHeadline): NormalizedIntelDoc {
  const text = `${h.title} ${h.summary}`;
  const sentiment =
    /\b(surge|rally|gain|rise|beat)\b/i.test(text) ? 0.35
    : /\b(fall|drop|decline|miss|cut)\b/i.test(text) ? -0.35
    : 0;
  return {
    diet: h.category === "general" || h.category?.includes("Fed") ? "macro" : "catalyst",
    source: h.source.toLowerCase().replace(/\s+/g, "-"),
    externalId: h.url ?? h.title.slice(0, 80),
    symbol: h.symbols?.[0],
    symbols: h.symbols ?? [],
    title: h.title,
    body: h.summary || h.title,
    url: h.url,
    sentiment,
    eventType: "headline",
    publishedAt: h.publishedAt,
  };
}

async function persistHeadlines(headlines: GeneralHeadline[], scanRunId: string): Promise<number> {
  let created = 0;
  for (const h of headlines) {
    const sentiment =
      /\b(surge|rally|gain|rise|beat)\b/i.test(h.title) ? "bullish"
      : /\b(fall|drop|decline|miss|cut)\b/i.test(h.title) ? "bearish"
      : "neutral";

    const category =
      h.symbols && h.symbols.length > 0
        ? `symbols:${h.symbols.join(",")}`
        : h.category ?? "markets";

    const newsRow = await persistNewsItem({
      symbol: h.symbols?.[0],
      headline: h.title,
      summary: h.summary || h.title,
      sentiment,
      source: h.source,
      url: h.url,
      category,
      publishedAt: h.publishedAt,
      scanRunId,
    });
    if (newsRow) created++;

    const doc = headlineToIntelDoc(h);
    const docId = await persistIntelDocument(doc, scanRunId);
    if (docId) created++;
  }
  return created;
}

async function ingestSymbolHeadlines(symbol: string, scanRunId: string): Promise<number> {
  const [yahoo, finnhub] = await Promise.all([
    fetchYahooFinanceNews(symbol),
    fetchFinnhubNews(symbol),
  ]);
  const normalized = normalizeNews(symbol, yahoo, finnhub);
  let created = 0;
  for (const h of normalized) {
    const row = await persistNewsItem({
      symbol,
      headline: h.headline,
      summary: h.summary,
      sentiment: h.sentiment,
      source: h.source,
      url: h.url,
      category: "symbol",
      publishedAt: h.publishedAt,
      scanRunId,
    });
    if (row) created++;
  }
  const docs = normalizeFinnhubNews(
    symbol,
    finnhub.map((f) => ({
      headline: f.headline,
      summary: f.summary,
      source: f.source,
      url: f.url,
      publishedAt: f.publishedAt,
      id: f.headline.slice(0, 80),
    })),
  );
  for (const doc of docs) {
    if (await persistIntelDocument(doc, scanRunId)) created++;
  }
  return created;
}

/**
 * News-focused ingest: free sources + AI scout. Intended to run every ~10 minutes.
 */
export async function runNewsScan(): Promise<void> {
  const run = await createScanRun("hot");
  let itemsCreated = 0;
  let error: string | undefined;

  try {
    const macroHeadlines = await fetchMacroNewsBundle();
    itemsCreated += await persistHeadlines(macroHeadlines, run.id);

    for (const symbol of HOT_SYMBOLS) {
      try {
        itemsCreated += await ingestSymbolHeadlines(symbol, run.id);
      } catch (err) {
        console.warn(`[intel/news] Symbol headline ingest failed for ${symbol}:`, err);
      }
    }

    itemsCreated += await runAiNewsScout(macroHeadlines, run.id);
    await synthesizeMorningBrief([...HOT_SYMBOLS], run.id);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  await completeScanRun(run.id, {
    symbolsScanned: HOT_SYMBOLS.length,
    signalsCreated: itemsCreated,
    error,
  });

  console.log(`[intel/news] Scan complete: ${itemsCreated} news items persisted`);
}
