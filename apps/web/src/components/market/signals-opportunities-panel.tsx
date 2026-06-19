"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Eye,
  Newspaper,
  Radio,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
import {
  INITIAL_SIGNALS,
  INVEST_OPPORTUNITIES_POOL,
  MARKET_NEWS_POOL,
  MARKET_PULSE_THEMES,
  TRADING_STRATEGIES,
  type InvestOpportunity,
  type LiveSignal,
  type MarketNewsItem,
  type SignalTimeframe,
} from "@/lib/market/market-intel-data";

export type FeedTab = "all" | "trading" | "investing" | "news";

type FeedEntry =
  | { kind: "signal"; item: LiveSignal; at: number }
  | { kind: "news"; item: MarketNewsItem; at: number }
  | { kind: "opportunity"; item: InvestOpportunity; at: number };

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function SignalFeedCard({
  sig,
  quote,
  flashing,
  onClick,
}: {
  sig: LiveSignal;
  quote?: { spot?: number; change24hPct?: number };
  flashing: boolean;
  onClick: () => void;
}) {
  const isBuy = sig.action === "BUY";
  const spot = quote?.spot ?? 0;
  const change = quote?.change24hPct ?? sig.change24h;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left terminal-card p-3.5 transition-all duration-300 hover:border-indigo-500/25",
        isBuy ? "shadow-[inset_0_0_0_1px_rgba(52,211,153,0.06)]" : "shadow-[inset_0_0_0_1px_rgba(248,113,113,0.06)]",
        flashing && (isBuy ? "border-emerald-500/40 bg-emerald-950/20 scale-[1.01]" : "border-red-500/40 bg-red-950/20 scale-[1.01]")
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <AssetLogoIcon symbol={sig.symbol} assetClass={sig.assetClass} sector={sig.sector} size="sm" className="rounded-md shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-white tracking-tight">{sig.symbol}</p>
            <p className="text-[10px] text-zinc-500 truncate">{sig.strategy}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
            {sig.timeframe}
          </span>
          <span
            className={cn(
              "text-[9px] font-extrabold px-1.5 py-0.5 rounded",
              isBuy ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" : "text-red-400 bg-red-500/10 border border-red-500/20"
            )}
          >
            {sig.action}
          </span>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-zinc-400 leading-snug line-clamp-2">{sig.reason}</p>
      <div className="mt-2 flex items-center justify-between border-t border-zinc-900/50 pt-2">
        <span className="text-xs font-bold text-zinc-200 terminal-num">
          {spot > 0
            ? `$${spot >= 1000 ? spot.toLocaleString(undefined, { maximumFractionDigits: 2 }) : spot.toFixed(spot < 10 ? 4 : 2)}`
            : "—"}
        </span>
        <span className={cn("text-[10px] font-bold terminal-num flex items-center gap-0.5", change >= 0 ? "text-emerald-400" : "text-red-400")}>
          {change >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
          {change >= 0 ? "+" : ""}
          {change.toFixed(2)}%
        </span>
      </div>
    </button>
  );
}

function NewsFeedCard({ item, onSymbolClick }: { item: MarketNewsItem; onSymbolClick: (s: string) => void }) {
  const sentimentIcon =
    item.sentiment === "bullish" ? (
      <ArrowUpRight className="size-3.5 text-emerald-400" />
    ) : item.sentiment === "bearish" ? (
      <ArrowDownRight className="size-3.5 text-red-400" />
    ) : (
      <Activity className="size-3.5 text-zinc-400" />
    );

  return (
    <article className="terminal-card p-3.5 space-y-2">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/15 shrink-0">
          <Newspaper className="size-3.5 text-indigo-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-zinc-100 leading-snug">{item.headline}</p>
          <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{item.summary}</p>
        </div>
        {sentimentIcon}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {item.symbols.map((sym) => (
          <button
            key={sym}
            type="button"
            onClick={() => onSymbolClick(sym)}
            className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-indigo-400 hover:border-indigo-500/30 cursor-pointer"
          >
            {sym}
          </button>
        ))}
        <span className="text-[9px] text-zinc-600 ml-auto">{item.source}</span>
      </div>
    </article>
  );
}

function OpportunityFeedCard({ item, onSymbolClick }: { item: InvestOpportunity; onSymbolClick: (s: string) => void }) {
  return (
    <article className="terminal-card p-3.5 space-y-2 border-violet-500/20">
      <div className="flex items-start gap-2">
        <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 shrink-0">
          <Target className="size-3.5 text-violet-400" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-white">{item.title}</p>
          <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{item.thesis}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[9px]">
        {item.symbols.map((sym) => (
          <button
            key={sym}
            type="button"
            onClick={() => onSymbolClick(sym)}
            className="font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-violet-300 hover:border-violet-500/30 cursor-pointer text-[9px]"
          >
            {sym}
          </button>
        ))}
        <span className="text-zinc-600 capitalize">{item.horizon}</span>
        <span className="text-amber-400/90 font-bold">{"★".repeat(item.conviction)}</span>
      </div>
    </article>
  );
}

export function SignalsOpportunitiesPanel({
  sidebarQuotes,
  onSignalClick,
  onSymbolClick,
  onAskAi,
  onClose,
  externalSignals,
  dbItems,
  loading = false,
  liveOnly = false,
}: {
  sidebarQuotes: Record<string, { spot?: number; change24hPct?: number }>;
  onSignalClick: (sig: LiveSignal) => void;
  onSymbolClick: (symbol: string) => void;
  onAskAi?: (prompt: string) => void;
  onClose?: () => void;
  externalSignals?: LiveSignal[];
  dbItems?: Array<{ kind: string; item: Record<string, unknown>; at: string }>;
  loading?: boolean;
  liveOnly?: boolean;
}) {
  const [tab, setTab] = useState<FeedTab>("all");
  const useLiveFeed = liveOnly || Boolean(dbItems?.length);
  const [liveSignals, setLiveSignals] = useState<LiveSignal[]>(externalSignals ?? (useLiveFeed ? [] : INITIAL_SIGNALS));
  const [flashingId, setFlashingId] = useState<string | null>(null);
  const [newsFeed, setNewsFeed] = useState(() =>
    useLiveFeed ? [] : MARKET_NEWS_POOL.map((item, i) => ({ item, at: Date.now() - i * 120_000 }))
  );
  const [pulseIdx, setPulseIdx] = useState(0);

  useEffect(() => {
    if (externalSignals?.length) setLiveSignals(externalSignals);
    else if (useLiveFeed) setLiveSignals([]);
  }, [externalSignals, useLiveFeed]);

  // Rotate mock signals only in demo mode
  useEffect(() => {
    if (useLiveFeed || externalSignals?.length || dbItems?.length) return;
    const interval = setInterval(() => {
      const idx = Math.floor(Math.random() * INITIAL_SIGNALS.length);
      const base = INITIAL_SIGNALS[idx];
      const actions: ("BUY" | "SELL")[] = ["BUY", "SELL"];
      const newAction = actions[Math.floor(Math.random() * actions.length)];
      const newStrategy = TRADING_STRATEGIES[Math.floor(Math.random() * TRADING_STRATEGIES.length)];
      const timeframes: SignalTimeframe[] = ["5m", "15m", "1H", "4H"];
      const newTimeframe = timeframes[Math.floor(Math.random() * timeframes.length)];
      const newChange = Math.random() * 8 - 4;
      const newReason =
        newAction === "BUY"
          ? `${newStrategy} triggered near support on ${newTimeframe}.`
          : `${newStrategy} resistance rejected on ${newTimeframe}.`;

      setLiveSignals((prev) => {
        const updated = [...prev];
        const existing = updated.findIndex((s) => s.id === base.id);
        const next = {
          ...base,
          action: newAction,
          strategy: newStrategy,
          timeframe: newTimeframe,
          change24h: newChange,
          reason: newReason,
        };
        if (existing >= 0) updated[existing] = next;
        else updated.unshift(next);
        return updated;
      });

      setFlashingId(base.id);
      setTimeout(() => setFlashingId(null), 2200);
    }, 7000);
    return () => clearInterval(interval);
  }, [externalSignals, dbItems, useLiveFeed]);

  // Inject fresh news headlines into the feed (mock mode only)
  useEffect(() => {
    if (useLiveFeed || dbItems?.length) return;
    const interval = setInterval(() => {
      const item = MARKET_NEWS_POOL[Math.floor(Math.random() * MARKET_NEWS_POOL.length)];
      setNewsFeed((prev) => [{ item, at: Date.now() }, ...prev].slice(0, 12));
      setPulseIdx((i) => (i + 1) % MARKET_PULSE_THEMES.length);
    }, 14_000);
    return () => clearInterval(interval);
  }, [dbItems, useLiveFeed]);

  const feed = useMemo((): FeedEntry[] => {
    if (dbItems?.length) {
      return dbItems.map((row) => {
        const at = new Date(row.at).getTime();
        if (row.kind === "signal") {
          const s = row.item;
          const sig: LiveSignal = {
            id: String(s.id ?? ""),
            symbol: String(s.symbol ?? ""),
            name: String(s.symbol ?? ""),
            assetClass: String(s.assetClass ?? "stock"),
            sector: s.sector ? String(s.sector) : undefined,
            action: s.action === "SELL" ? "SELL" : "BUY",
            strategy: String(s.strategy ?? "").replace(/_/g, " "),
            timeframe: (String(s.timeframe ?? "1H") as SignalTimeframe) || "1H",
            reason: String(s.reason ?? ""),
            change24h: 0,
          };
          return { kind: "signal" as const, item: sig, at };
        }
        if (row.kind === "news") {
          const n = row.item;
          return {
            kind: "news" as const,
            item: {
              id: String(n.id ?? at),
              headline: String(n.headline ?? ""),
              summary: String(n.summary ?? ""),
              sentiment: (String(n.sentiment ?? "neutral") as MarketNewsItem["sentiment"]),
              symbols: n.symbol ? [String(n.symbol)] : [],
              source: String(n.source ?? ""),
              category: (String(n.category ?? "macro") as MarketNewsItem["category"]),
            },
            at,
          };
        }
        const s = row.item;
        return {
          kind: "opportunity" as const,
          item: {
            id: String(s.id ?? at),
            title: String(s.title ?? ""),
            thesis: String(s.thesis ?? ""),
            symbols: Array.isArray(s.symbols) ? (s.symbols as string[]) : [],
            horizon: (String(s.horizon ?? "swing") as InvestOpportunity["horizon"]),
            conviction: Number(s.conviction ?? 3) as InvestOpportunity["conviction"],
            style: (String(s.style ?? "thematic") as InvestOpportunity["style"]),
          },
          at,
        };
      }).filter((e) => {
        if (tab === "trading") return e.kind === "signal";
        if (tab === "investing") return e.kind === "opportunity";
        if (tab === "news") return e.kind === "news";
        return true;
      });
    }

    const now = Date.now();
    const signals: FeedEntry[] = liveSignals.map((item, i) => ({
      kind: "signal",
      item,
      at: now - i * 45_000,
    }));
    const news: FeedEntry[] = newsFeed.map(({ item, at }) => ({ kind: "news", item, at }));
    const opps: FeedEntry[] = INVEST_OPPORTUNITIES_POOL.map((item, i) => ({
      kind: "opportunity",
      item,
      at: now - 600_000 - i * 90_000,
    }));

    let merged = [...signals, ...news, ...opps].sort((a, b) => b.at - a.at);

    if (tab === "trading") merged = merged.filter((e) => e.kind === "signal");
    if (tab === "investing") merged = merged.filter((e) => e.kind === "opportunity");
    if (tab === "news") merged = merged.filter((e) => e.kind === "news");

    return merged;
  }, [liveSignals, newsFeed, tab, dbItems]);

  const tabs: { id: FeedTab; label: string; icon: React.ReactNode }[] = [
    { id: "all", label: "All", icon: <Eye className="size-3" /> },
    { id: "trading", label: "Trading", icon: <Zap className="size-3" /> },
    { id: "investing", label: "Investing", icon: <Target className="size-3" /> },
    { id: "news", label: "News", icon: <Newspaper className="size-3" /> },
  ];

  const handleSymbol = useCallback(
    (sym: string) => {
      onSymbolClick(sym);
    },
    [onSymbolClick]
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#07070c]/95">
      {/* Header */}
      <header className="shrink-0 px-4 py-4 border-b border-zinc-900/60 bg-zinc-950/40">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative shrink-0">
              <div className="size-9 rounded-xl bg-gradient-to-br from-indigo-600/30 to-violet-600/20 border border-indigo-500/25 flex items-center justify-center">
                <Eye className="size-4 text-indigo-300" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 border-2 border-[#07070c] animate-pulse" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-indigo-400/90">God&apos;s Eye</p>
              <h2 className="text-sm font-extrabold text-white truncate">Signals &amp; Opportunities</h2>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 text-zinc-500 hover:text-white transition-all cursor-pointer"
                title="Collapse panel"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Radio className="size-3 text-emerald-400 animate-pulse" />
            <span className="text-[9px] font-extrabold text-emerald-400 uppercase tracking-wider">Live</span>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">
          Real-time strategies, investment theses, and market-moving headlines — your panoramic view of global markets.
        </p>
      </header>

      {/* Market pulse strip */}
      <div className="shrink-0 px-3 py-2 border-b border-zinc-900/40 bg-zinc-950/20 overflow-x-auto scrollbar-none">
        <div className="flex gap-2 min-w-max">
          {MARKET_PULSE_THEMES.map((t, i) => (
            <div
              key={t.label}
              className={cn(
                "px-2.5 py-1.5 rounded-lg border text-[9px] font-mono transition-all",
                i === pulseIdx % MARKET_PULSE_THEMES.length
                  ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
                  : "border-zinc-800/60 bg-zinc-950/40 text-zinc-500"
              )}
            >
              <span className="text-zinc-600 block text-[8px] uppercase tracking-wider">{t.label}</span>
              <span className="font-bold">{t.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex gap-1 p-2 border-b border-zinc-900/40">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold tracking-wide transition-all cursor-pointer",
              tab === t.id ? "terminal-tab-active" : "terminal-tab-idle"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2.5 scrollbar-thin scrollbar-thumb-zinc-800">
        {loading && feed.length === 0 ? (
          <div className="terminal-card p-8 text-center space-y-3">
            <div className="size-10 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 animate-spin mx-auto" />
            <p className="text-sm font-medium text-zinc-300">Building live feed…</p>
            <p className="text-xs text-zinc-500">Signals and headlines appear as the scan completes.</p>
          </div>
        ) : null}
        {!loading && feed.length === 0 && useLiveFeed ? (
          <div className="terminal-card p-8 text-center">
            <p className="text-sm text-zinc-400">No feed items yet. Analysis is still running.</p>
          </div>
        ) : null}
        {feed.map((entry) => {
          if (entry.kind === "signal") {
            return (
              <div key={`sig-${entry.item.id}-${entry.at}`} className="space-y-1">
                <span className="text-[9px] font-mono text-zinc-600 pl-1">{timeAgo(entry.at)} · Trading signal</span>
                <SignalFeedCard
                  sig={entry.item}
                  quote={sidebarQuotes[entry.item.symbol]}
                  flashing={flashingId === entry.item.id}
                  onClick={() => onSignalClick(entry.item)}
                />
              </div>
            );
          }
          if (entry.kind === "news") {
            return (
              <div key={`news-${entry.item.id}-${entry.at}`} className="space-y-1">
                <span className="text-[9px] font-mono text-zinc-600 pl-1">{timeAgo(entry.at)} · Market news</span>
                <NewsFeedCard item={entry.item} onSymbolClick={handleSymbol} />
              </div>
            );
          }
          return (
            <div key={`opp-${entry.item.id}`} className="space-y-1">
              <span className="text-[9px] font-mono text-zinc-600 pl-1">{timeAgo(entry.at)} · Investment idea</span>
              <OpportunityFeedCard item={entry.item} onSymbolClick={handleSymbol} />
            </div>
          );
        })}
      </div>

      {/* Footer CTA */}
      {onAskAi ? (
        <div className="shrink-0 p-3 border-t border-zinc-900/60 bg-zinc-950/30">
          <button
            type="button"
            onClick={() =>
              onAskAi(
                "Scan the live signals feed and give me the top 3 highest-conviction trading and investing opportunities right now with risk notes."
              )
            }
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600/80 to-violet-600/80 hover:from-indigo-500 hover:to-violet-500 text-white text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 border border-indigo-400/20 cursor-pointer transition-all"
          >
            <Sparkles className="size-3.5" />
            Ask AI to synthesize feed
          </button>
        </div>
      ) : null}
    </div>
  );
}
