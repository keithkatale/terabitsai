"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Pin, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
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

function TrendSignal({
  change,
  tagged,
}: {
  change: number;
  tagged?: boolean;
}) {
  if (tagged) {
    return <Pin className="size-3 shrink-0 text-[#5988ff]" strokeWidth={2.25} aria-label="Pinned" />;
  }

  if (change > 0.05) {
    return (
      <TrendingUp
        className="size-3.5 shrink-0 text-emerald-400"
        strokeWidth={2.25}
        aria-label="Uptrend"
      />
    );
  }

  if (change < -0.05) {
    return (
      <TrendingDown
        className="size-3.5 shrink-0 text-red-400"
        strokeWidth={2.25}
        aria-label="Downtrend"
      />
    );
  }

  return (
    <Minus className="size-3.5 shrink-0 text-zinc-500" strokeWidth={2.25} aria-label="Flat" />
  );
}

function MarketCard({
  symbol,
  quote,
  tagged,
  tagDisabled,
  onSelect,
}: {
  symbol: string;
  quote?: Quote;
  tagged?: boolean;
  tagDisabled?: boolean;
  onSelect?: (symbol: string) => void;
}) {
  const change = quote?.change24hPct ?? 0;
  const bullish = change >= 0;
  const hasQuote = quote?.spot != null;
  const assetClass = assetClassForSymbol(symbol);

  const movementClass = tagged
    ? "text-[#5988ff]"
    : bullish
      ? "text-emerald-400"
      : "text-red-400";

  return (
    <button
      type="button"
      onClick={() => onSelect?.(symbol)}
      className={cn(
        "flex h-[52px] w-[128px] shrink-0 items-center gap-2 rounded-lg border px-2 py-2 text-left transition-colors",
        tagged
          ? "border-[#5988ff]/35 bg-[#316bff]/8"
          : "border-white/8 bg-[#0a0d10] hover:border-white/14 hover:bg-white/[0.03]",
        !tagged && tagDisabled && "opacity-50",
        "cursor-pointer",
      )}
    >
      <AssetLogoIcon symbol={symbol} assetClass={assetClass} size="xs" className="shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-semibold leading-tight text-zinc-100">
          {displayName(symbol)}
        </span>
        {hasQuote ? (
          <span className={cn("font-mono text-[10px] font-semibold leading-tight", movementClass)}>
            {bullish ? "+" : ""}
            {change.toFixed(2)}%
          </span>
        ) : (
          <span className="mt-0.5 block h-2.5 w-10 animate-pulse rounded bg-white/[0.06]" />
        )}
      </div>
      <TrendSignal change={change} tagged={tagged} />
    </button>
  );
}

function QueueRow({
  symbols,
  quotes,
  taggedSymbols,
  maxTags,
  reverse,
  durationSec,
  onSelect,
}: {
  symbols: string[];
  quotes: Record<string, Quote>;
  taggedSymbols: string[];
  maxTags: number;
  reverse?: boolean;
  durationSec: number;
  onSelect?: (symbol: string) => void;
}) {
  const atMax = taggedSymbols.length >= maxTags;
  const loopSymbols = useMemo(() => [...symbols, ...symbols], [symbols]);

  return (
    <div className="w-full overflow-hidden">
      <div
        className={cn("market-queue-track flex w-max gap-2.5 py-1", reverse && "market-queue-track-reverse")}
        style={{ animationDuration: `${durationSec}s` }}
      >
        {loopSymbols.map((symbol, i) => {
          const tagged = taggedSymbols.includes(symbol);
          return (
            <MarketCard
              key={`${symbol}-${i}`}
              symbol={symbol}
              quote={quotes[symbol]}
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

  const allSymbols = useMemo(() => MARKET_ROWS.flat(), []);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let quoteTimer: ReturnType<typeof setInterval> | null = null;

    const fetchQuotes = async () => {
      const batchSize = 4;
      const next: Record<string, Quote> = {};
      for (let i = 0; i < allSymbols.length; i += batchSize) {
        if (!active) return;
        const batch = allSymbols.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(async (symbol) => {
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
        for (const r of results) {
          if (r.status === "fulfilled" && r.value) {
            next[r.value.symbol] = {
              spot: r.value.spot,
              change24hPct: r.value.change24hPct,
            };
          }
        }
        if (Object.keys(next).length > 0) {
          setQuotes((prev) => ({ ...prev, ...next }));
        }
      }
    };

    void fetchQuotes();
    quoteTimer = setInterval(() => void fetchQuotes(), 60_000);

    return () => {
      active = false;
      if (quoteTimer) clearInterval(quoteTimer);
    };
  }, [allSymbols, enabled]);

  return (
    <div className="mt-6 w-full max-w-5xl space-y-2.5 overflow-hidden">
      {MARKET_ROWS.map((row, i) => (
        <QueueRow
          key={row.join("-")}
          symbols={row}
          quotes={quotes}
          taggedSymbols={taggedSymbols}
          maxTags={maxTags}
          reverse={i === 1}
          durationSec={i === 0 ? 48 : 54}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
