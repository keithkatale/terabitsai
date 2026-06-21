"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
import { assetClassForNewsSymbol } from "@/lib/news/infer-symbols";

export type NewsCardData = {
  id: string;
  headline: string;
  summary: string;
  sentiment: "bullish" | "bearish" | "neutral";
  source: string;
  url: string | null;
  createdAt: string;
  symbols: string[];
};

function sentimentGradient(sentiment: NewsCardData["sentiment"], isAi: boolean) {
  if (isAi) return "from-violet-950/80 via-indigo-950/50 to-zinc-950/30";
  if (sentiment === "bullish") return "from-emerald-950/70 via-zinc-950/40 to-zinc-950/20";
  if (sentiment === "bearish") return "from-red-950/60 via-zinc-950/40 to-zinc-950/20";
  return "from-indigo-950/50 via-zinc-950/40 to-zinc-950/20";
}

function NewsCardHero({
  url,
  sentiment,
  isAi,
  symbols,
}: {
  url: string | null;
  sentiment: NewsCardData["sentiment"];
  isAi: boolean;
  symbols: string[];
}) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    if (!url) {
      setPreviewSrc(null);
      setPreviewFailed(false);
      return;
    }
    let cancelled = false;
    setPreviewFailed(false);
    fetch(`/api/news/preview-image?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((data: { imageUrl?: string | null }) => {
        if (cancelled) return;
        if (data.imageUrl) {
          setPreviewSrc(`/api/news/preview-image?url=${encodeURIComponent(url)}&proxy=1`);
        } else {
          setPreviewFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setPreviewFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const showFallback = !previewSrc || previewFailed;
  const heroSymbols = symbols.slice(0, 3);

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-white/[0.04]">
      {!showFallback ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewSrc!}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setPreviewFailed(true)}
        />
      ) : (
        <div className={cn("absolute inset-0 bg-gradient-to-br", sentimentGradient(sentiment, isAi))}>
          <div className="absolute inset-0 flex items-center justify-center gap-3 px-4">
            {heroSymbols.length > 0 ? (
              heroSymbols.map((symbol) => (
                <AssetLogoIcon
                  key={symbol}
                  symbol={symbol}
                  assetClass={assetClassForNewsSymbol(symbol)}
                  size="lg"
                  className="rounded-xl shadow-lg ring-1 ring-white/10"
                />
              ))
            ) : (
              <div className="flex size-14 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/10">
                {isAi ? (
                  <Sparkles className="size-6 text-violet-300" />
                ) : (
                  <span className="text-lg font-bold text-indigo-300">MKT</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--background)]/90 via-[var(--background)]/20 to-transparent" />
      {isAi ? (
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-200">
          <Sparkles className="size-3" />
          AI Scout
        </span>
      ) : null}
    </div>
  );
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function NewsGridCard({
  item,
  onSymbolClick,
}: {
  item: NewsCardData;
  onSymbolClick?: (symbol: string) => void;
}) {
  const isAi = item.source === "ai-scout";

  const cardInner = (
    <>
      <NewsCardHero
        url={item.url}
        sentiment={item.sentiment}
        isAi={isAi}
        symbols={item.symbols}
      />
      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-100 group-hover:text-white">
          {item.headline}
        </h3>
        <p className="mt-1.5 line-clamp-2 flex-1 text-[11px] leading-relaxed text-zinc-500">{item.summary}</p>

        {item.symbols.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {item.symbols.map((symbol) => (
              <button
                key={symbol}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSymbolClick?.(symbol);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-1.5 py-0.5 text-[9px] font-bold text-indigo-300 transition-colors hover:border-indigo-500/35 hover:bg-indigo-500/10"
              >
                <AssetLogoIcon
                  symbol={symbol}
                  assetClass={assetClassForNewsSymbol(symbol)}
                  size="xs"
                  className="rounded-sm"
                />
                {symbol}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-zinc-900/50 pt-2 text-[10px]">
          <span className="truncate font-medium text-zinc-500">{isAi ? "AI curated" : item.source}</span>
          <span className="inline-flex shrink-0 items-center gap-1 font-mono text-zinc-600">
            {timeAgo(item.createdAt)}
            {item.url ? <ExternalLink className="size-3 opacity-60" /> : null}
          </span>
        </div>
      </div>
    </>
  );

  const className = cn(
    "terminal-card group relative flex h-full flex-col overflow-hidden p-0 text-left transition-all duration-200",
    "hover:border-indigo-500/25 hover:shadow-[0_8px_30px_rgba(99,102,241,0.06)]",
  );

  if (item.url) {
    return (
      <a href={item.url} target="_blank" rel="noopener noreferrer" className={className}>
        {cardInner}
      </a>
    );
  }

  return <article className={className}>{cardInner}</article>;
}

export function NewsGridCardSkeleton() {
  return (
    <div className="terminal-card animate-pulse overflow-hidden p-0">
      <div className="aspect-[16/10] bg-zinc-900/50" />
      <div className="space-y-2 p-3.5">
        <div className="h-4 w-4/5 rounded bg-zinc-900/70" />
        <div className="h-3 w-full rounded bg-zinc-900/50" />
        <div className="h-3 w-2/3 rounded bg-zinc-900/50" />
      </div>
    </div>
  );
}

export function VerifiedNewsGridCard({
  title,
  body,
  source,
  url,
  symbols,
  onSymbolClick,
}: {
  title: string;
  body: string;
  source: string;
  url: string | null;
  symbols: string[];
  onSymbolClick?: (symbol: string) => void;
}) {
  const item: NewsCardData = {
    id: title,
    headline: title,
    summary: body,
    sentiment: "neutral",
    source,
    url,
    createdAt: new Date().toISOString(),
    symbols,
  };

  return <NewsGridCard item={item} onSymbolClick={onSymbolClick} />;
}
