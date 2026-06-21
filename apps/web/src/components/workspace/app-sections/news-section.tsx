"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Newspaper, RefreshCcw } from "lucide-react";
import type { IntelDocument, SynthesisBrief } from "@quant/contracts";
import { cn } from "@/lib/utils";
import { SynthesisCard } from "@/components/market/synthesis-card";
import { resolveNewsSymbols } from "@/lib/news/infer-symbols";
import {
  NewsGridCard,
  NewsGridCardSkeleton,
  VerifiedNewsGridCard,
  type NewsCardData,
} from "@/components/news/news-grid-card";

type NewsItem = {
  id: string;
  symbol: string | null;
  headline: string;
  summary: string;
  sentiment: "bullish" | "bearish" | "neutral";
  source: string;
  url: string | null;
  category: string | null;
  createdAt: string;
};

type NewsFilter = "all" | "ai" | "sources" | "verified";

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function toCardData(item: NewsItem): NewsCardData {
  return {
    id: item.id,
    headline: item.headline,
    summary: item.summary,
    sentiment: item.sentiment,
    source: item.source,
    url: item.url,
    createdAt: item.createdAt,
    symbols: resolveNewsSymbols(item),
  };
}

export function NewsSection({
  enabled = true,
  onSymbolClick,
  variant = "page",
}: {
  enabled?: boolean;
  onSymbolClick?: (symbol: string) => void;
  variant?: "page" | "intel";
}) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<"scanning" | "ready" | "running" | "error">("ready");
  const [filter, setFilter] = useState<NewsFilter>("all");
  const [items, setItems] = useState<NewsItem[]>([]);
  const [documents, setDocuments] = useState<IntelDocument[]>([]);
  const [briefs, setBriefs] = useState<SynthesisBrief[]>([]);
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!enabled) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch("/api/intel/news");
      const data = await res.json();
      if (!data.success) {
        setStatus("error");
        return;
      }

      setStatus(data.status ?? "ready");
      setLastScanAt(data.lastScanAt ?? null);

      const newsItems: NewsItem[] = (data.items ?? [])
        .filter((row: { kind: string }) => row.kind === "news")
        .map((row: { item: NewsItem; at: string }) => ({
          ...row.item,
          createdAt: row.item.createdAt ?? row.at,
        }));

      setItems(newsItems);
      setDocuments(data.documents ?? []);
      setBriefs(data.briefs ?? []);
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void load();
    const pollMs = status === "scanning" || status === "running" ? 8000 : 30_000;
    const t = setInterval(() => void load(true), pollMs);
    return () => clearInterval(t);
  }, [enabled, load, status]);

  const cardItems = useMemo(() => {
    const filtered =
      filter === "ai"
        ? items.filter((i) => i.source === "ai-scout")
        : filter === "sources"
          ? items.filter((i) => i.source !== "ai-scout")
          : items;
    return filtered.map(toCardData);
  }, [filter, items]);

  const morningBrief = briefs.find((b) => b.briefType === "morning") ?? briefs[0];

  const filters: Array<{ id: NewsFilter; label: string }> = [
    { id: "all", label: "All" },
    { id: "ai", label: "AI Scout" },
    { id: "sources", label: "Headlines" },
    { id: "verified", label: "Verified" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-zinc-900/60 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Newspaper className="size-4 text-indigo-400" />
            <div>
              <h1 className="text-sm font-extrabold text-white">
                {variant === "intel" ? "Intel Feed" : "Market News"}
              </h1>
              <p className="text-[11px] text-zinc-500">
                {variant === "intel"
                  ? "Headlines and catalysts your agent team consumes."
                  : "Curated cards with linked assets — refreshed every ~10 minutes."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="terminal-btn terminal-btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px]"
          >
            <RefreshCcw className={cn("size-3", refreshing && "animate-spin")} />
            Refresh
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
          {(status === "scanning" || status === "running") && (
            <span className="inline-flex items-center gap-1 text-indigo-400">
              <Loader2 className="size-3 animate-spin" />
              Fetching latest headlines…
            </span>
          )}
          {status === "ready" && lastScanAt ? (
            <span className="text-zinc-600">Last ingest {timeAgo(lastScanAt)}</span>
          ) : null}
          {status === "error" ? <span className="text-red-400">Could not load news feed</span> : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {filters.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors",
                filter === id
                  ? "border border-indigo-500/25 bg-indigo-500/15 text-indigo-300"
                  : "border border-zinc-800/60 text-zinc-500 hover:text-zinc-300",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading && items.length === 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <NewsGridCardSkeleton key={i} />
            ))}
          </div>
        ) : filter === "verified" ? (
          documents.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-600">
              No verified documents yet. Start the intel worker to populate the database.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {documents.map((doc) => (
                <VerifiedNewsGridCard
                  key={doc.id}
                  title={doc.title}
                  body={doc.body}
                  source={doc.source}
                  url={doc.url ?? null}
                  symbols={resolveNewsSymbols({
                    headline: doc.title,
                    summary: doc.body,
                    documentSymbols: doc.symbols?.length ? doc.symbols : doc.symbol ? [doc.symbol] : [],
                  })}
                  onSymbolClick={onSymbolClick}
                />
              ))}
            </div>
          )
        ) : (
          <div className="space-y-4">
            {morningBrief && filter !== "sources" ? (
              <div className="space-y-2">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400/90">
                  AI market brief
                </p>
                <SynthesisCard brief={morningBrief} onSymbolClick={onSymbolClick} />
              </div>
            ) : null}

            {cardItems.length === 0 ? (
              <p className="py-12 text-center text-sm text-zinc-600">
                No headlines in this view yet. The news agent runs every 10 minutes when the intel worker is active.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {cardItems.map((item) => (
                  <NewsGridCard key={item.id} item={item} onSymbolClick={onSymbolClick} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
