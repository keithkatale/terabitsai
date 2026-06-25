import type { HyperliquidPerpMarket } from "./client";

type GenuiNode = Record<string, unknown>;

function fmtUsd(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(digits)}`;
}

function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

function trendFromDelta(n: number | null | undefined): "up" | "down" | "flat" {
  if (n == null || !Number.isFinite(n) || Math.abs(n) < 0.01) return "flat";
  return n > 0 ? "up" : "down";
}

function accentFromDelta(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "zinc";
  return n > 0 ? "emerald" : n < 0 ? "rose" : "zinc";
}

export function buildHyperliquidMarketGenui(market: HyperliquidPerpMarket) {
  const view: GenuiNode[] = [
    {
      type: "section",
      title: `Hyperliquid · ${market.coin}`,
      subtitle: "On-chain perp market",
      children: [
        {
          type: "grid",
          columns: 2,
          children: [
            {
              type: "metricCard",
              label: "Mark price",
              value: fmtUsd(market.markPx),
              delta: fmtPct(market.change24hPct),
              trend: trendFromDelta(market.change24hPct),
              accent: accentFromDelta(market.change24hPct),
            },
            {
              type: "metricCard",
              label: "Funding APR",
              value: fmtPct(market.fundingAprPct),
              sublabel: market.fundingHrPct != null ? `${market.fundingHrPct.toFixed(4)}% / hr` : undefined,
              accent: (market.fundingAprPct ?? 0) > 20 ? "amber" : "cyan",
            },
            {
              type: "metricCard",
              label: "Open interest",
              value: market.openInterest != null ? market.openInterest.toLocaleString() : "—",
              accent: "violet",
            },
            {
              type: "metricCard",
              label: "24h volume",
              value: fmtUsd(market.dayNtlVlm, 0),
              accent: "sky",
            },
          ],
        },
      ],
    },
  ];

  return { view };
}

export function buildHyperliquidBookGenui(payload: {
  coin: string;
  bestBid: number | null;
  bestAsk: number | null;
  mid: number | null;
  spread: number | null;
}) {
  const spreadBps =
    payload.mid && payload.spread != null ? ((payload.spread / payload.mid) * 10000).toFixed(1) : null;

  return {
    view: [
      {
        type: "section",
        title: `Order book · ${payload.coin}`,
        children: [
          {
            type: "grid",
            columns: 2,
            children: [
              {
                type: "metricCard",
                label: "Best bid",
                value: fmtUsd(payload.bestBid),
                accent: "emerald",
              },
              {
                type: "metricCard",
                label: "Best ask",
                value: fmtUsd(payload.bestAsk),
                accent: "rose",
              },
              {
                type: "metricCard",
                label: "Mid",
                value: fmtUsd(payload.mid),
                accent: "cyan",
              },
              {
                type: "metricCard",
                label: "Spread",
                value: payload.spread != null ? fmtUsd(payload.spread, 4) : "—",
                sublabel: spreadBps ? `${spreadBps} bps` : undefined,
                accent: "amber",
              },
            ],
          },
        ],
      },
    ],
  };
}

export function buildHyperliquidFundingGenui(
  row: Record<string, unknown>,
  mode: "compare" | "history",
) {
  if (mode === "history") {
    const latest = row as { fundingRatePct?: number | null; fundingAprPct?: number | null; time?: string | null };
    return {
      view: [
        {
          type: "metricCard",
          label: "Latest funding",
          value: fmtPct(latest.fundingRatePct, 4),
          sublabel: latest.fundingAprPct != null ? `APR ${fmtPct(latest.fundingAprPct)}` : undefined,
          accent: "amber",
        },
      ],
    };
  }

  const coin = String(row.coin ?? "");
  return {
    view: [
      {
        type: "section",
        title: `Funding arb · ${coin}`,
        subtitle: "HL vs CEX predicted APR",
        children: [
          {
            type: "grid",
            columns: 2,
            children: [
              {
                type: "metricCard",
                label: "HL APR",
                value: fmtPct(row.hlAprPct as number | null),
                accent: "cyan",
              },
              {
                type: "metricCard",
                label: "Binance APR",
                value: fmtPct(row.binanceAprPct as number | null),
                accent: "amber",
              },
              {
                type: "metricCard",
                label: "HL vs Binance",
                value: fmtPct(row.hlVsBinancePct as number | null),
                trend: trendFromDelta(row.hlVsBinancePct as number | null),
                accent: accentFromDelta(row.hlVsBinancePct as number | null),
              },
              {
                type: "metricCard",
                label: "HL vs Bybit",
                value: fmtPct(row.hlVsBybitPct as number | null),
                trend: trendFromDelta(row.hlVsBybitPct as number | null),
                accent: accentFromDelta(row.hlVsBybitPct as number | null),
              },
            ],
          },
        ],
      },
    ],
  };
}

export function buildHyperliquidCandlesGenui(payload: {
  coin: string;
  interval: string;
  candles: Array<{ close: number | null }>;
}) {
  const closes = payload.candles.map((c) => c.close).filter((c): c is number => c != null);
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  const change = last != null && prev != null && prev !== 0 ? ((last - prev) / prev) * 100 : null;
  const sparkline = closes.slice(-24);

  return {
    view: [
      {
        type: "metricCard",
        label: `${payload.coin} · ${payload.interval}`,
        value: fmtUsd(last),
        delta: change != null ? fmtPct(change) : undefined,
        trend: trendFromDelta(change),
        sparkline: sparkline.length >= 2 ? sparkline : undefined,
        accent: accentFromDelta(change),
      },
    ],
  };
}

export function buildHyperliquidMarketsListGenui(
  markets: HyperliquidPerpMarket[],
  title = "Hyperliquid top markets",
) {
  const items = markets.slice(0, 8).map((m) => ({
    label: m.coin,
    value: `${fmtUsd(m.markPx)} · ${fmtPct(m.change24hPct)}`,
    accent: accentFromDelta(m.change24hPct),
  }));

  return {
    view: [
      {
        type: "barlist",
        title,
        items,
        unit: "",
      },
    ],
  };
}
