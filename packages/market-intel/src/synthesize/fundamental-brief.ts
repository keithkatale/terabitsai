import { prisma } from "@quant/db";
import { persistSynthesisBrief } from "../persist-synthesis.js";
import { fetchFmpTranscript } from "../ingest/fmp-data.js";

export async function synthesizeEarningsBrief(symbol: string, scanRunId?: string) {
  const content = await fetchFmpTranscript(symbol);
  if (!content) return null;

  const lower = content.toLowerCase();
  const bullishPhrases = ["raised guidance", "beat expectations", "record revenue", "strong demand", "margin expansion"];
  const bearishPhrases = ["macro headwind", "lower guidance", "missed expectations", "inventory build", "soft demand"];

  const bullish = bullishPhrases.filter((p) => lower.includes(p));
  const bearish = bearishPhrases.filter((p) => lower.includes(p));

  const headline = `${symbol} earnings: ${bullish.length > bearish.length ? "bullish" : bearish.length > bullish.length ? "bearish" : "mixed"} transcript signals`;
  const thesis = `Analyzed earnings call transcript for ${symbol}. Found ${bullish.length} bullish and ${bearish.length} bearish phrase clusters.`;

  return persistSynthesisBrief({
    briefType: "fundamental",
    symbols: [symbol],
    headline,
    thesis,
    bullets: { bullish, bearish, actionable: ["Review full transcript for guidance language delta"] },
    impactScore: Math.min(10, 5 + bullish.length + bearish.length),
    confidence: 0.75,
    provenance: [{ source: "fmp", title: `${symbol} earnings transcript`, excerpt: content.slice(0, 300) }],
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    scanRunId
  });
}

export async function synthesizeFlowBrief(
  symbol: string,
  events: Array<{ title: string; body: string; sentiment?: number }>,
  scanRunId?: string
) {
  if (events.length === 0) return null;
  const avg = events.reduce((s, e) => s + (e.sentiment ?? 0), 0) / events.length;
  const bias = avg > 0.2 ? "accumulation" : avg < -0.2 ? "distribution" : "neutral";

  return persistSynthesisBrief({
    briefType: "flow",
    symbols: [symbol],
    headline: `${symbol} smart-money activity: ${bias} pattern detected`,
    thesis: `${events.length} flow events in the recent window suggest ${bias} by informed participants.`,
    bullets: {
      actionable: events.slice(0, 3).map((e) => e.title)
    },
    impactScore: Math.min(10, 4 + events.length),
    confidence: 0.65,
    provenance: events.map((e) => ({ source: "fmp", title: e.title, excerpt: e.body.slice(0, 150) })),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    scanRunId
  });
}
