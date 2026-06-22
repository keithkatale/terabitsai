import { CapitalBroker } from "@quant/broker";
import { prisma } from "@quant/db";
import { fetchMtfCandles } from "./mtf-fetcher.js";
import {
  analyzeMomentumModule,
  analyzeStructureModule,
  analyzeTrendModule,
  analyzeVolatilityModule,
  analyzeVolumeModule,
  detectRegime,
  getMtfBias,
  mtfAgrees,
} from "./modules.js";
import type { ConfluenceResult, TradeSetup, TradeDirection } from "./types.js";

const DEFAULT_WATCHLIST = ["BTCUSD", "ETHUSD", "US100", "US500", "GOLD", "OIL_CRUDE"];

async function getTopSignalSymbols(limit = 10): Promise<string[]> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await prisma.marketSignal.findMany({
      where: { createdAt: { gte: since }, action: { in: ["BUY", "SELL"] } },
      select: { symbol: true },
    });
    const counts = new Map<string, number>();
    for (const r of recent) {
      counts.set(r.symbol, (counts.get(r.symbol) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([symbol]) => symbol);
  } catch {
    return [];
  }
}

function aggregateVotes(
  votes: ReturnType<typeof analyzeTrendModule>[]
): { buyScore: number; sellScore: number } {
  let buyScore = 0;
  let sellScore = 0;
  for (const v of votes) {
    if (v.direction === "BUY") buyScore += v.score * v.weight;
    else if (v.direction === "SELL") sellScore += v.score * v.weight;
  }
  return {
    buyScore: Math.min(100, buyScore),
    sellScore: Math.min(100, sellScore),
  };
}

function buildSetup(
  symbol: string,
  direction: TradeDirection,
  entry: number,
  atrVal: number | null,
  confluenceScore: number,
  rationale: string[],
  regime: ReturnType<typeof detectRegime>,
  mtf: ReturnType<typeof getMtfBias>
): TradeSetup {
  const stopDistance = atrVal != null ? atrVal * 1.5 : entry * 0.01;
  const atrStop =
    direction === "BUY" ? entry - stopDistance : entry + stopDistance;
  const targets =
    direction === "BUY"
      ? [entry + stopDistance, entry + stopDistance * 2, entry + stopDistance * 3]
      : [entry - stopDistance, entry - stopDistance * 2, entry - stopDistance * 3];

  return {
    symbol,
    direction,
    entry,
    atrStop,
    stopDistance,
    targets,
    confluenceScore,
    rationale,
    regime,
    timeframeBias: mtf.bias,
    timeframeSetup: mtf.setup,
    timeframeTrigger: mtf.trigger,
  };
}

export async function analyzeSymbol(
  broker: CapitalBroker,
  symbol: string,
  minConfluence = 60
): Promise<ConfluenceResult | null> {
  const mtf = await fetchMtfCandles(broker, symbol);
  if (mtf.hour.length < 30) return null;

  const regime = detectRegime(mtf.hour);
  const mtfBias = getMtfBias(mtf);

  const trend = analyzeTrendModule(mtf.hour);
  const momentum = analyzeMomentumModule(mtf.hour, regime);
  const volatility = analyzeVolatilityModule(mtf.hour);
  const structure = analyzeStructureModule(mtf.hour);
  const volume = analyzeVolumeModule(mtf.hour);

  const votes = [trend, momentum, volatility, structure, volume];
  const { buyScore, sellScore } = aggregateVotes(votes);

  let direction: TradeDirection | null = null;
  let score = 0;
  if (buyScore >= minConfluence && buyScore > sellScore) {
    direction = "BUY";
    score = buyScore;
  } else if (sellScore >= minConfluence && sellScore > buyScore) {
    direction = "SELL";
    score = sellScore;
  }

  if (!direction || !mtfAgrees(direction, mtfBias)) {
    return {
      symbol,
      buyScore,
      sellScore,
      votes,
      regime,
    };
  }

  const entry = mtf.hour[mtf.hour.length - 1]?.c ?? 0;
  const rationale = votes
    .filter((v) => v.direction === direction)
    .map((v) => `[${v.module}] ${v.reason}`);

  const setup = buildSetup(
    symbol,
    direction,
    entry,
    volatility.atrVal,
    score,
    rationale,
    regime,
    mtfBias
  );

  return { symbol, buyScore, sellScore, votes, regime, setup };
}

export async function scanAndRankSetups(
  broker: CapitalBroker,
  options: {
    minConfluence?: number;
    allowedAssets?: string[];
    limit?: number;
  } = {}
): Promise<TradeSetup[]> {
  const minConfluence = options.minConfluence ?? 60;
  const limit = options.limit ?? 5;

  const ranked = await getTopSignalSymbols(10);
  let candidates =
    ranked.length > 0
      ? [...new Set([...ranked, ...DEFAULT_WATCHLIST])]
      : DEFAULT_WATCHLIST;

  if (options.allowedAssets && options.allowedAssets.length > 0) {
    candidates = candidates.filter((s) => options.allowedAssets!.includes(s));
  }

  const results: TradeSetup[] = [];
  for (const symbol of candidates.slice(0, 20)) {
    try {
      const analysis = await analyzeSymbol(broker, symbol, minConfluence);
      if (analysis?.setup) results.push(analysis.setup);
    } catch (err) {
      console.warn(`[strategy] analyze ${symbol} failed:`, err);
    }
  }

  return results
    .sort((a, b) => b.confluenceScore - a.confluenceScore)
    .slice(0, limit);
}
