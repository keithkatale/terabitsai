"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
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

function parseChangePercent(change?: string): number | null {
  if (!change?.trim()) return null;
  const n = parseFloat(change.replace(/%/g, "").replace(/\+/g, ""));
  return Number.isFinite(n) ? n : null;
}

function signalFromTrend(trend?: string, changePct?: number | null) {
  if (trend === "up") return { label: "Bull", bullish: true };
  if (trend === "down") return { label: "Bear", bullish: false };
  if (trend === "flat") return { label: "Flat", bullish: true };
  if (changePct != null) {
    return changePct >= 0
      ? { label: "Bull", bullish: true }
      : { label: "Bear", bullish: false };
  }
  return { label: "—", bullish: true };
}

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

/** Minimal live asset tile — signal, name, and % move only (no chart). */
export function QuantAssetCard({
  symbol,
  name,
  range = "1M",
  spot,
  change,
  trend,
}: {
  symbol: string;
  name?: string;
  range?: ChartRange;
  spot?: string;
  change?: string;
  trend?: string;
}) {
  const initialChange = parseChangePercent(change);
  const [loading, setLoading] = useState(initialChange == null);
  const [changePct, setChangePct] = useState<number | null>(initialChange);

  useEffect(() => {
    if (initialChange != null) {
      setChangePct(initialChange);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/market/quote?symbol=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setChangePct(
          typeof data.change24hPct === "number" ? data.change24hPct : null,
        );
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, initialChange]);

  const displayName =
    name?.replace(" CFD", "").replace(" / USD", "") ??
    symbol.replace("USD", "");
  const signal = signalFromTrend(trend, changePct);
  const signalClass = signal.bullish ? "text-emerald-400" : "text-red-400";

  return (
    <div className="flex h-[52px] w-full min-w-[96px] flex-col justify-center gap-0.5 rounded-lg border border-white/8 bg-[#0a0d10] px-2.5 py-2">
      <div className="flex min-w-0 items-center justify-between gap-1">
        <span className="truncate text-[11px] font-semibold leading-none text-zinc-100">
          {displayName}
        </span>
        <span
          className={cn(
            "shrink-0 text-[8px] font-bold uppercase tracking-wide",
            signalClass,
          )}
        >
          {signal.label}
        </span>
      </div>
      {loading ? (
        <span className="h-2.5 w-10 animate-pulse rounded bg-white/[0.06]" />
      ) : changePct != null ? (
        <span className={cn("font-mono text-[10px] font-semibold leading-none", signalClass)}>
          {changePct >= 0 ? "+" : ""}
          {changePct.toFixed(2)}%
        </span>
      ) : (
        <span className="font-mono text-[10px] leading-none text-zinc-500">
          {spot ? `$${spot}` : "—"}
        </span>
      )}
    </div>
  );
}
