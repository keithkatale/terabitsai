import type { SignalAction } from "@quant/contracts";
import type { YahooHeadline } from "../ingest/yahoo-news.js";
import type { FinnhubHeadline } from "../ingest/finnhub-news.js";

export type NewsHeadline = {
  headline: string;
  summary: string;
  source: string;
  url?: string;
  publishedAt?: Date;
  sentiment: "bullish" | "bearish" | "neutral";
};

const BULLISH = /\b(surge|rally|beat|upgrade|record|growth|bullish|gain|soar|jump|breakout|approval)\b/i;
const BEARISH = /\b(plunge|crash|miss|downgrade|bearish|fall|drop|selloff|lawsuit|ban|cut|warning)\b/i;

function scoreSentiment(text: string): "bullish" | "bearish" | "neutral" {
  const bull = BULLISH.test(text);
  const bear = BEARISH.test(text);
  if (bull && !bear) return "bullish";
  if (bear && !bull) return "bearish";
  return "neutral";
}

export function normalizeNews(
  symbol: string,
  yahoo: YahooHeadline[],
  finnhub: FinnhubHeadline[]
): NewsHeadline[] {
  const items: NewsHeadline[] = [];

  for (const y of yahoo) {
    const text = `${y.title} ${y.publisher}`;
    items.push({
      headline: y.title,
      summary: y.title,
      source: y.publisher,
      url: y.url,
      publishedAt: y.publishedAt,
      sentiment: scoreSentiment(text)
    });
  }

  for (const f of finnhub) {
    const text = `${f.headline} ${f.summary}`;
    items.push({
      headline: f.headline,
      summary: f.summary || f.headline,
      source: f.source,
      url: f.url,
      publishedAt: f.publishedAt,
      sentiment: scoreSentiment(text)
    });
  }

  return items.slice(0, 8);
}

export function newsToSignals(headlines: NewsHeadline[]): Array<{
  strategy: string;
  action: SignalAction;
  timeframe: string;
  confidence: number;
  reason: string;
  headline: NewsHeadline;
}> {
  return headlines
    .filter((h) => h.sentiment !== "neutral")
    .map((h) => ({
      strategy: "NEWS_SENTIMENT",
      action: (h.sentiment === "bullish" ? "BUY" : "SELL") as SignalAction,
      timeframe: "1D",
      confidence: 0.55,
      reason: `Headline bias ${h.sentiment}: ${h.headline.slice(0, 120)}`,
      headline: h
    }));
}
