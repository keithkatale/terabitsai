import { fundingToApr, hyperliquidInfoFetch, num, pctChange } from "./api";

export type HyperliquidPerpMarket = {
  coin: string;
  markPx: number | null;
  midPx: number | null;
  change24hPct: number | null;
  fundingHrPct: number | null;
  fundingAprPct: number | null;
  openInterest: number | null;
  dayNtlVlm: number | null;
  maxLeverage: number | null;
  delisted: boolean;
};

function normalizePerpMarkets(meta: { universe?: Array<{ name: string; maxLeverage?: number; isDelisted?: boolean }> }, ctxs: Record<string, unknown>[]): HyperliquidPerpMarket[] {
  const universe = meta?.universe ?? [];
  return universe.map((u, i) => {
    const c = ctxs?.[i] ?? {};
    const funding = num(c.funding);
    return {
      coin: u.name,
      markPx: num(c.markPx),
      midPx: num(c.midPx),
      change24hPct: pctChange(c.markPx, c.prevDayPx),
      fundingHrPct: funding == null ? null : funding * 100,
      fundingAprPct: fundingToApr(c.funding, 1),
      openInterest: num(c.openInterest),
      dayNtlVlm: num(c.dayNtlVlm),
      maxLeverage: u.maxLeverage ?? null,
      delisted: u.isDelisted === true,
    };
  });
}

export async function fetchHyperliquidMarkets(opts: {
  coin?: string;
  sort?: string;
  limit?: number;
  includeDelisted?: boolean;
}) {
  const data = await hyperliquidInfoFetch({ type: "metaAndAssetCtxs" });
  const [meta, ctxs] = Array.isArray(data) ? data : [null, []];
  let rows = normalizePerpMarkets(meta ?? {}, ctxs ?? []);

  if (!opts.includeDelisted) rows = rows.filter((r) => !r.delisted);
  if (opts.coin) {
    const f = opts.coin.toUpperCase();
    rows = rows.filter((r) => r.coin.toUpperCase().includes(f));
  }

  const sortKey = opts.sort ?? "dayNtlVlm";
  rows.sort((a, b) => {
    const av = (a as Record<string, unknown>)[sortKey];
    const bv = (b as Record<string, unknown>)[sortKey];
    const an = typeof av === "number" ? av : -Infinity;
    const bn = typeof bv === "number" ? bv : -Infinity;
    return bn - an;
  });

  const limit = Math.min(Math.max(1, opts.limit ?? 50), 500);
  return { success: true as const, markets: rows.slice(0, limit) };
}

const INTERVAL_MS: Record<string, number> = {
  "1m": 60_000,
  "3m": 180_000,
  "5m": 300_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "2h": 7_200_000,
  "4h": 14_400_000,
  "8h": 28_800_000,
  "12h": 43_200_000,
  "1d": 86_400_000,
  "3d": 259_200_000,
  "1w": 604_800_000,
  "1M": 2_592_000_000,
};

export async function fetchHyperliquidCandles(opts: {
  coin: string;
  interval?: string;
  limit?: number;
}) {
  const interval = opts.interval ?? "1h";
  const ms = INTERVAL_MS[interval];
  if (!ms) throw new Error(`Unsupported interval: ${interval}`);

  const limit = Math.min(Math.max(1, opts.limit ?? 100), 5000);
  const endTime = Date.now();
  const startTime = endTime - limit * ms;

  const rows = await hyperliquidInfoFetch({
    type: "candleSnapshot",
    req: { coin: opts.coin.toUpperCase(), interval, startTime, endTime },
  });

  const candles = (Array.isArray(rows) ? rows : []).map((c: Record<string, unknown>) => ({
    time: c.t ? new Date(Number(c.t)).toISOString() : null,
    open: num(c.o),
    high: num(c.h),
    low: num(c.l),
    close: num(c.c),
    volume: num(c.v),
    trades: c.n ?? null,
  }));

  return { success: true as const, coin: opts.coin.toUpperCase(), interval, candles };
}

export async function fetchHyperliquidBook(opts: { coin: string; depth?: number }) {
  const payload = await hyperliquidInfoFetch({
    type: "l2Book",
    coin: opts.coin.toUpperCase(),
  });

  const levels = (payload as { levels?: Array<Array<{ px: string; sz: string; n?: number }>> })?.levels ?? [[], []];
  const depth = Math.min(Math.max(1, opts.depth ?? 10), 20);
  const mk = (side: "bid" | "ask") => (lvl: { px: string; sz: string; n?: number }, i: number) => ({
    side,
    level: i + 1,
    px: num(lvl.px),
    sz: num(lvl.sz),
    orders: lvl.n ?? null,
  });

  const bids = (levels[0] ?? []).slice(0, depth).map(mk("bid"));
  const asks = (levels[1] ?? []).slice(0, depth).map(mk("ask"));
  const bestBid = bids[0]?.px ?? null;
  const bestAsk = asks[0]?.px ?? null;
  const mid = bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : null;

  return {
    success: true as const,
    coin: opts.coin.toUpperCase(),
    bestBid,
    bestAsk,
    mid,
    spread: bestBid != null && bestAsk != null ? bestAsk - bestBid : null,
    levels: [...bids, ...asks],
  };
}

const VENUE_KEYS: Record<string, string> = { HlPerp: "hl", BinPerp: "binance", BybitPerp: "bybit" };

export async function fetchHyperliquidFundingCompare(opts: { coin?: string; limit?: number }) {
  const data = await hyperliquidInfoFetch({ type: "predictedFundings" });
  const filter = opts.coin ? opts.coin.toUpperCase() : null;
  const rows: Array<Record<string, unknown>> = [];

  for (const entry of (Array.isArray(data) ? data : []) as Array<[string, Array<[string, Record<string, unknown>]>]>) {
    const coin = entry?.[0];
    if (filter && String(coin).toUpperCase() !== filter) continue;

    const apr: Record<string, number | null> = {};
    let nextHl: unknown = null;
    for (const [vName, v] of entry?.[1] ?? []) {
      const key = VENUE_KEYS[vName];
      if (!key || !v) continue;
      apr[key] = fundingToApr(v.fundingRate, num(v.fundingIntervalHours) ?? 1);
      if (key === "hl") nextHl = v.nextFundingTime;
    }

    const hl = apr.hl ?? null;
    rows.push({
      coin,
      hlAprPct: hl,
      binanceAprPct: apr.binance ?? null,
      bybitAprPct: apr.bybit ?? null,
      hlVsBinancePct: hl != null && apr.binance != null ? hl - apr.binance : null,
      hlVsBybitPct: hl != null && apr.bybit != null ? hl - apr.bybit : null,
      nextHlFunding: nextHl ? new Date(Number(nextHl)).toISOString() : null,
    });
  }

  rows.sort((a, b) => Math.abs(Number(b.hlVsBinancePct ?? 0)) - Math.abs(Number(a.hlVsBinancePct ?? 0)));
  const limit = Math.min(Math.max(1, opts.limit ?? 30), 200);
  return { success: true as const, funding: rows.slice(0, limit) };
}

export async function fetchHyperliquidFundingHistory(opts: { coin: string; hours?: number }) {
  const hours = Math.min(Math.max(1, opts.hours ?? 24), 168);
  const startTime = Date.now() - hours * 3_600_000;
  const rows = await hyperliquidInfoFetch({
    type: "fundingHistory",
    coin: opts.coin.toUpperCase(),
    startTime,
  });

  const history = (Array.isArray(rows) ? rows : []).map((r: Record<string, unknown>) => {
    const rate = num(r.fundingRate);
    return {
      coin: r.coin,
      fundingRatePct: rate == null ? null : rate * 100,
      fundingAprPct: fundingToApr(r.fundingRate, 1),
      time: r.time ? new Date(Number(r.time)).toISOString() : null,
    };
  });

  return { success: true as const, coin: opts.coin.toUpperCase(), history };
}
