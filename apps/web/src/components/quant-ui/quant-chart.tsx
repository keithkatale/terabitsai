"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Activity, Loader2 } from "lucide-react";
import { AssetPriceChart } from "@/components/generative-ui/asset-price-chart";
import type { ChartCandle, ChartRange } from "@/lib/chat/chart-data-tool";

type ChartApiResponse = {
  success: boolean;
  error?: string;
  symbol?: string;
  display_name?: string;
  range?: ChartRange;
  quote?: { spot: number; change24hPct: number | null };
  candles?: ChartCandle[];
  chart_props?: {
    spot: number;
    bid: number;
    ask: number;
    change24hPct: number | null;
    high: number;
    low: number;
    marketStatus?: string;
    dataSource: string;
    fetchedAt: string;
    candleCount: number;
    variant: "line" | "area";
  };
};

export function QuantChart({
  symbol,
  name,
  range = "1M",
  variant = "area",
  spot,
  change,
  high,
  low,
  dataSource = "capital.com",
}: {
  symbol: string;
  name?: string;
  range?: ChartRange;
  variant?: "line" | "area";
  spot?: string;
  change?: string;
  high?: string;
  low?: string;
  dataSource?: string;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [payload, setPayload] = useState<ChartApiResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState("loading");

    const params = new URLSearchParams({
      symbol,
      range,
      variant,
    });

    fetch(`/api/market/chart?${params}`)
      .then((r) => r.json())
      .then((data: ChartApiResponse) => {
        if (cancelled) return;
        if (!data.success) {
          setState("error");
          setPayload(data);
          return;
        }
        setPayload(data);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, range, variant]);

  if (state === "loading") {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-zinc-800/60 bg-zinc-950/40">
        <Loader2 className="size-5 animate-spin text-cyan-400" />
        <span className="ml-2 text-xs text-zinc-500">Loading {name ?? symbol}…</span>
      </div>
    );
  }

  if (state === "error" || !payload?.chart_props) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-950/10 p-4 text-left text-xs text-rose-300">
        Could not load live chart for {name ?? symbol}. {payload?.error ?? "Check Capital.com credentials."}
      </div>
    );
  }

  const props = payload.chart_props;
  const candles = payload.candles ?? [];

  return (
    <AssetPriceChart
      symbol={payload.symbol ?? symbol}
      displayName={name ?? payload.display_name ?? symbol}
      range={range}
      variant={variant}
      spot={props.spot ?? Number(spot) ?? 0}
      bid={props.bid}
      ask={props.ask}
      change24hPct={props.change24hPct}
      high={props.high ?? Number(high)}
      low={props.low ?? Number(low)}
      marketStatus={props.marketStatus}
      dataSource={props.dataSource ?? dataSource}
      fetchedAt={props.fetchedAt}
      candleCount={props.candleCount}
      candles={candles}
    />
  );
}

export function QuantAssetCard({
  symbol,
  name,
  range = "1M",
  onExpand,
}: {
  symbol: string;
  name?: string;
  range?: ChartRange;
  spot?: string;
  change?: string;
  trend?: string;
  onExpand?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (expanded) {
    return (
      <div className="col-span-full">
        <QuantChart symbol={symbol} name={name} range={range} />
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-2 text-[11px] text-zinc-500 hover:text-zinc-300"
        >
          Collapse
        </button>
      </div>
    );
  }

  return (
    <QuantAssetCardCompact
      symbol={symbol}
      name={name}
      range={range}
      onExpand={() => {
        setExpanded(true);
        onExpand?.();
      }}
    />
  );
}

function QuantAssetCardCompact({
  symbol,
  name,
  range = "1M",
  onExpand,
}: {
  symbol: string;
  name?: string;
  range?: ChartRange;
  onExpand: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [spot, setSpot] = useState(0);
  const [change, setChange] = useState<number | null>(null);
  const [sparkline, setSparkline] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/market/chart?symbol=${encodeURIComponent(symbol)}&range=${range}`)
      .then((r) => r.json())
      .then((data: ChartApiResponse) => {
        if (cancelled || !data.success) return;
        setSpot(data.quote?.spot ?? data.chart_props?.spot ?? 0);
        setChange(data.quote?.change24hPct ?? data.chart_props?.change24hPct ?? null);
        setSparkline((data.candles ?? []).slice(-24).map((c) => c.c));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  const isUp = change == null ? true : change >= 0;
  const stroke = isUp ? "#34d399" : "#f87171";

  return (
    <button
      type="button"
      onClick={onExpand}
      className="group flex w-full flex-col rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-3 text-left transition-colors hover:border-cyan-500/30 hover:bg-zinc-900/40"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{name ?? symbol}</p>
        <Activity className="size-3 text-zinc-600 group-hover:text-cyan-400" />
      </div>
      {loading ? (
        <Loader2 className="mt-3 size-4 animate-spin text-zinc-600" />
      ) : (
        <>
          <p className={cn("mt-1 text-lg font-semibold tracking-tight", isUp ? "text-emerald-300" : "text-rose-300")}>
            {spot.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          {change != null ? (
            <p className={cn("text-[11px] font-medium", isUp ? "text-emerald-400/90" : "text-rose-400/90")}>
              {change >= 0 ? "+" : ""}
              {change.toFixed(2)}%
            </p>
          ) : null}
          {sparkline.length > 1 ? (
            <svg viewBox="0 0 120 36" className="mt-2 h-9 w-full overflow-visible">
              <SparklinePath data={sparkline} stroke={stroke} />
            </svg>
          ) : null}
        </>
      )}
    </button>
  );
}

function SparklinePath({ data, stroke }: { data: number[]; stroke: string }) {
  const w = 120;
  const h = 36;
  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / Math.max(1, data.length - 1);
  const d = data
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + (h - pad * 2) * (1 - (v - min) / range);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return <path d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" />;
}
