"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
import { cn } from "@/lib/utils";
import { getCapitalAssetCatalog } from "@/lib/catalog/capital-assets";
import { HOT_SYMBOLS, assetClassForSymbol } from "@/lib/market/watchlist";

const CATALOG = getCapitalAssetCatalog();

const MARKET_ROWS: string[][] = [
  HOT_SYMBOLS.slice(0, 6),
  HOT_SYMBOLS.slice(6, 12),
];

type Quote = { spot: number; change24hPct: number };

function displayName(symbol: string) {
  const item = CATALOG.find((a) => a.symbol === symbol);
  return (
    item?.display_name.replace(" CFD", "").replace(" / USD", "") ??
    symbol.replace("USD", "")
  );
}

function formatPrice(spot: number) {
  if (spot >= 1000) {
    return spot.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  if (spot >= 1) return spot.toFixed(2);
  return spot.toFixed(4);
}

function MiniTrend({
  points,
  bullish,
}: {
  points: { x: number; y: number }[];
  bullish: boolean;
}) {
  const id = useId();
  if (points.length === 0) {
    return <div className="h-9 w-full rounded-md bg-white/[0.04] animate-pulse" />;
  }
  const path = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");
  const color = bullish ? "#4ade80" : "#f87171";
  const gradId = `mq-${id.replace(/:/g, "")}`;

  return (
    <svg className="h-9 w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L 100 100 L 0 100 Z`} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MarketCard({
  symbol,
  quote,
  sparkline,
  tagged,
  tagDisabled,
  onSelect,
}: {
  symbol: string;
  quote?: Quote;
  sparkline: { x: number; y: number }[];
  tagged?: boolean;
  tagDisabled?: boolean;
  onSelect?: (symbol: string) => void;
}) {
  const change = quote?.change24hPct ?? 0;
  const bullish = change >= 0;
  const spot = quote?.spot;
  const assetClass = assetClassForSymbol(symbol);
  const sector =
    assetClass === "crypto"
      ? "Crypto"
      : assetClass === "forex"
        ? "Forex"
        : assetClass === "index"
          ? "Indices"
          : assetClass === "commodity"
            ? "Commodities"
            : "Stocks";

  return (
    <button
      type="button"
      onClick={() => onSelect?.(symbol)}
      className={cn(
        "group flex h-[148px] w-[140px] shrink-0 flex-col rounded-[20px] border p-3.5 text-left transition-all duration-200",
        "bg-white/[0.07] backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_10px_28px_rgba(0,0,0,0.18)]",
        tagged
          ? "border-blue-400/45 ring-1 ring-blue-400/30 bg-blue-500/[0.08]"
          : "border-white/10 hover:border-blue-400/30 hover:bg-white/[0.1]",
        !tagged && tagDisabled && "opacity-60",
        "hover:-translate-y-0.5 cursor-pointer",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <AssetLogoIcon
          symbol={symbol}
          assetClass={assetClass}
          sector={sector}
          size="sm"
          className="rounded-[12px] border border-white/10 shadow-sm"
        />
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide",
            tagged
              ? "bg-blue-500/20 text-blue-200"
              : bullish
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-red-500/15 text-red-300",
          )}
        >
          {tagged ? "Pinned" : bullish ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
          {!tagged && (bullish ? "Bull" : "Bear")}
        </span>
      </div>

      <div className="mt-2 min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-white leading-tight">{displayName(symbol)}</p>
        <p className="mt-0.5 font-mono text-[9px] text-zinc-400">{symbol}</p>
        {spot != null ? (
          <div className="mt-1.5 flex items-baseline justify-between gap-1">
            <span className="font-mono text-[11px] font-bold text-white">${formatPrice(spot)}</span>
            <span className={cn("font-mono text-[9px] font-semibold", bullish ? "text-emerald-400" : "text-red-400")}>
              {bullish ? "+" : ""}
              {change.toFixed(2)}%
            </span>
          </div>
        ) : (
          <div className="mt-2 h-4 w-16 rounded bg-white/[0.06] animate-pulse" />
        )}
      </div>

      <div className="mt-2 rounded-[10px] border border-white/[0.06] bg-white/[0.03] px-1 py-0.5">
        <MiniTrend points={sparkline} bullish={bullish} />
      </div>
    </button>
  );
}

function QueueRow({
  symbols,
  quotes,
  sparklines,
  taggedSymbols,
  maxTags,
  reverse,
  durationSec,
  onSelect,
}: {
  symbols: string[];
  quotes: Record<string, Quote>;
  sparklines: Record<string, { x: number; y: number }[]>;
  taggedSymbols: string[];
  maxTags: number;
  reverse?: boolean;
  durationSec: number;
  onSelect?: (symbol: string) => void;
}) {
  const atMax = taggedSymbols.length >= maxTags;
  const loopSymbols = useMemo(() => [...symbols, ...symbols], [symbols]);

  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
      <div
        className={cn("market-queue-track flex w-max gap-3.5 py-1", reverse && "market-queue-track-reverse")}
        style={{ animationDuration: `${durationSec}s` }}
      >
        {loopSymbols.map((symbol, i) => {
          const tagged = taggedSymbols.includes(symbol);
          return (
            <MarketCard
              key={`${symbol}-${i}`}
              symbol={symbol}
              quote={quotes[symbol]}
              sparkline={sparklines[symbol] ?? []}
              tagged={tagged}
              tagDisabled={atMax && !tagged}
              onSelect={onSelect}
            />
          );
        })}
      </div>
    </div>
  );
}

export function MarketPreviewQueue({
  taggedSymbols = [],
  maxTags = 3,
  onSelect,
  enabled = true,
}: {
  taggedSymbols?: string[];
  maxTags?: number;
  onSelect?: (symbol: string) => void;
  enabled?: boolean;
}) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [sparklines, setSparklines] = useState<Record<string, { x: number; y: number }[]>>({});

  const allSymbols = useMemo(() => MARKET_ROWS.flat(), []);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    const fetchQuotes = async () => {
      const results = await Promise.allSettled(
        allSymbols.map(async (symbol) => {
          const assetClass = assetClassForSymbol(symbol);
          const res = await fetch(`/api/market/quote?symbol=${symbol}&assetClass=${assetClass}`);
          if (!res.ok) return null;
          const data = await res.json();
          return {
            symbol,
            spot: data.spot ?? 0,
            change24hPct: data.change24hPct ?? 0,
          };
        }),
      );
      if (!active) return;
      const next: Record<string, Quote> = {};
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          next[r.value.symbol] = {
            spot: r.value.spot,
            change24hPct: r.value.change24hPct,
          };
        }
      }
      setQuotes(next);
    };

    const fetchSparklines = async () => {
      const results = await Promise.allSettled(
        allSymbols.map(async (symbol) => {
          const res = await fetch(`/api/market/candles?symbol=${symbol}&range=1W`);
          if (!res.ok) return null;
          const data = await res.json();
          const points = data.points ?? [];
          if (points.length < 2) return null;
          const closes = points.map((p: { close: number }) => p.close);
          const min = Math.min(...closes);
          const max = Math.max(...closes);
          const range = max - min || 1;
          const spark = points.map((p: { close: number }, i: number) => ({
            x: (i / (points.length - 1)) * 100,
            y: 12 + ((max - p.close) / range) * 76,
          }));
          return { symbol, spark };
        }),
      );
      if (!active) return;
      const next: Record<string, { x: number; y: number }[]> = {};
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          next[r.value.symbol] = r.value.spark;
        }
      }
      setSparklines(next);
    };

    fetchQuotes();
    fetchSparklines();
    const interval = setInterval(fetchQuotes, 30_000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [allSymbols, enabled]);

  return (
    <div className="mt-6 w-full space-y-3.5">
      {MARKET_ROWS.map((row, i) => (
        <QueueRow
          key={row.join("-")}
          symbols={row}
          quotes={quotes}
          sparklines={sparklines}
          taggedSymbols={taggedSymbols}
          maxTags={maxTags}
          reverse={i === 1}
          durationSec={i === 0 ? 52 : 58}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
