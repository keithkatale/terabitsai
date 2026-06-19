"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpIcon,
  Briefcase,
  ChevronLeft,
  LineChart,
  Radar,
  RefreshCcwIcon,
  SparklesIcon,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
import { SmoothAreaChart } from "@/components/ui/smooth-area-chart";
import { ASSET_CATALOG } from "@/lib/catalog/asset-catalog";
import { HOT_SYMBOLS } from "@/lib/market/watchlist";
import type { CatalystRadarItem } from "@quant/contracts";
import type { MarketTerminalProps } from "../types";

type FeedSignal = {
  symbol: string;
  strategy: string;
  action: string;
  reason: string;
  sector?: string | null;
};

type MarketsTabProps = Pick<
  MarketTerminalProps,
  | "activeSymbol"
  | "activeCategory"
  | "selectedTimeframe"
  | "setSelectedTimeframe"
  | "candlePoints"
  | "sidebarQuotes"
  | "positions"
  | "tradeDirection"
  | "setTradeDirection"
  | "tradeSize"
  | "setTradeSize"
  | "tradeLeverage"
  | "setTradeLeverage"
  | "activeQuoteSpot"
  | "activeQuoteBid"
  | "activeQuoteAsk"
  | "activeQuoteChange"
  | "onTradeExecute"
  | "onClosePosition"
  | "onAnalyzeWithAi"
  | "onCardClick"
  | "onSignalClick"
> & {
  symbolOverride?: string;
  feedSignals?: FeedSignal[];
  onOpenAssetTab?: (symbol: string) => void;
  onBackToMarkets?: () => void;
};

function MarketScannerView({
  sidebarQuotes,
  feedSignals,
  onOpenAsset,
  onSignalClick,
}: {
  sidebarQuotes: MarketsTabProps["sidebarQuotes"];
  feedSignals: FeedSignal[];
  onOpenAsset: (symbol: string) => void;
  onSignalClick: MarketTerminalProps["onSignalClick"];
}) {
  const [radar, setRadar] = useState<CatalystRadarItem[]>([]);

  useEffect(() => {
    fetch("/api/intel/radar")
      .then((r) => r.json())
      .then((d) => {
        if (d?.items?.length) setRadar(d.items);
      })
      .catch(() => {});
  }, []);

  const movers = useMemo(() => {
    return [...HOT_SYMBOLS]
      .map((symbol) => {
        const q = sidebarQuotes[symbol];
        const change = q?.change24hPct ?? 0;
        const spot = q?.spot ?? 0;
        const radarItem = radar.find((r) => r.symbol === symbol);
        return { symbol, change, spot, heat: radarItem?.heat ?? 0, headline: radarItem?.headline };
      })
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }, [sidebarQuotes, radar]);

  const gainers = movers.filter((m) => m.change > 0).slice(0, 6);
  const losers = movers.filter((m) => m.change < 0).slice(0, 6);
  const signals = feedSignals.slice(0, 12);

  return (
    <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
      <section className="terminal-card-raised p-4 border-indigo-500/20">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/15 border border-indigo-500/25">
            <Radar className="size-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white">What&apos;s Moving</h2>
            <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
              AI scans {HOT_SYMBOLS.length} core assets across stocks, crypto, forex, and commodities — surfacing
              direction, signals, and catalyst heat. Click any row to drill into chart and trade ticket.
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MoverColumn title="Gainers" items={gainers} direction="up" onOpenAsset={onOpenAsset} />
        <MoverColumn title="Losers" items={losers} direction="down" onOpenAsset={onOpenAsset} />
      </div>

      <section className="terminal-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-indigo-400" />
          <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">AI Signals</h3>
          <span className="text-[9px] text-zinc-600 terminal-num ml-auto">{signals.length} active</span>
        </div>
        {signals.length === 0 ? (
          <p className="text-xs text-zinc-600 py-4 text-center">
            Signals warming up — intel worker scans every few minutes.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {signals.map((sig, i) => {
              const isBuy = sig.action === "BUY";
              const change = sidebarQuotes[sig.symbol]?.change24hPct ?? 0;
              return (
                <button
                  key={`${sig.symbol}-${sig.strategy}-${i}`}
                  type="button"
                  onClick={() => {
                    onOpenAsset(sig.symbol);
                    onSignalClick({
                      id: String(i),
                      symbol: sig.symbol,
                      name: sig.symbol,
                      assetClass: "stock",
                      sector: sig.sector ?? undefined,
                      action: isBuy ? "BUY" : "SELL",
                      strategy: sig.strategy.replace(/_/g, " "),
                      timeframe: "1H",
                      reason: sig.reason,
                      change24h: change,
                    });
                  }}
                  className={cn(
                    "text-left rounded-xl border p-3 transition-all cursor-pointer",
                    "bg-zinc-950/50 hover:bg-zinc-900/40 border-zinc-800/60 hover:border-indigo-500/20"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AssetLogoIcon symbol={sig.symbol} size="sm" className="rounded-md" />
                      <span className="text-xs terminal-num font-bold text-white">{sig.symbol}</span>
                    </div>
                    <span
                      className={cn(
                        "text-[9px] font-extrabold px-1.5 py-0.5 rounded terminal-num",
                        isBuy ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" : "text-red-400 bg-red-500/10 border border-red-500/20"
                      )}
                    >
                      {sig.action}
                    </span>
                  </div>
                  <p className="text-[10px] text-indigo-300/80 mt-1 font-medium">{sig.strategy.replace(/_/g, " ")}</p>
                  <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2">{sig.reason}</p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {radar.length > 0 ? (
        <section className="terminal-card p-4 space-y-3">
          <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Catalyst Heat</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {radar.slice(0, 6).map((item) => (
              <button
                key={item.symbol}
                type="button"
                onClick={() => onOpenAsset(item.symbol)}
                className="text-left rounded-lg border border-zinc-900/60 bg-zinc-950/50 p-2.5 hover:border-indigo-500/30 cursor-pointer"
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] terminal-num font-bold text-white">{item.symbol}</span>
                  <span className="text-[9px] text-zinc-500">{item.impactScore}/10</span>
                </div>
                <p className="text-[9px] text-zinc-600 mt-1 line-clamp-2">{item.headline}</p>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function MoverColumn({
  title,
  items,
  direction,
  onOpenAsset,
}: {
  title: string;
  items: Array<{ symbol: string; change: number; spot: number; headline?: string }>;
  direction: "up" | "down";
  onOpenAsset: (symbol: string) => void;
}) {
  const Icon = direction === "up" ? TrendingUp : TrendingDown;
  const color = direction === "up" ? "text-emerald-400" : "text-red-400";

  return (
    <section className="terminal-card p-4 space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("size-4", color)} />
        <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-[10px] text-zinc-600 py-4 text-center">No movers in this direction yet.</p>
      ) : (
        items.map((m) => (
          <button
            key={m.symbol}
            type="button"
            onClick={() => onOpenAsset(m.symbol)}
            className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-zinc-900/40 bg-zinc-950/60 hover:border-indigo-500/25 cursor-pointer text-left"
          >
            <AssetLogoIcon symbol={m.symbol} size="sm" className="rounded-md shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] terminal-num font-bold text-white">{m.symbol}</p>
              {m.headline ? <p className="text-[9px] text-zinc-600 truncate">{m.headline}</p> : null}
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] terminal-num text-zinc-400">
                {m.spot > 0
                  ? `$${m.spot >= 1000 ? m.spot.toLocaleString(undefined, { maximumFractionDigits: 2 }) : m.spot.toFixed(m.spot < 10 ? 4 : 2)}`
                  : "—"}
              </p>
              <p className={cn("text-[10px] terminal-num font-bold", color)}>
                {m.change >= 0 ? "+" : ""}
                {m.change.toFixed(2)}%
              </p>
            </div>
          </button>
        ))
      )}
    </section>
  );
}

function AssetDetailView({
  symbol,
  activeCategory,
  selectedTimeframe,
  setSelectedTimeframe,
  candlePoints,
  sidebarQuotes,
  positions,
  tradeDirection,
  setTradeDirection,
  tradeSize,
  setTradeSize,
  tradeLeverage,
  setTradeLeverage,
  activeQuoteSpot,
  activeQuoteBid,
  activeQuoteAsk,
  activeQuoteChange,
  onTradeExecute,
  onClosePosition,
  onAnalyzeWithAi,
  onBackToMarkets,
}: {
  symbol: string;
  activeCategory: string;
  selectedTimeframe: string;
  setSelectedTimeframe: (tf: string) => void;
  candlePoints: MarketsTabProps["candlePoints"];
  sidebarQuotes: MarketsTabProps["sidebarQuotes"];
  positions: MarketsTabProps["positions"];
  tradeDirection: "BUY" | "SELL";
  setTradeDirection: (d: "BUY" | "SELL") => void;
  tradeSize: number;
  setTradeSize: (n: number) => void;
  tradeLeverage: number;
  setTradeLeverage: (n: number) => void;
  activeQuoteSpot: number;
  activeQuoteBid: number;
  activeQuoteAsk: number;
  activeQuoteChange: number;
  onTradeExecute: MarketsTabProps["onTradeExecute"];
  onClosePosition: MarketsTabProps["onClosePosition"];
  onAnalyzeWithAi: () => void;
  onBackToMarkets?: () => void;
}) {
  const spot = sidebarQuotes[symbol]?.spot ?? activeQuoteSpot;
  const change = sidebarQuotes[symbol]?.change24hPct ?? activeQuoteChange;

  return (
    <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-zinc-900/60 bg-zinc-950/30">
        <div className="flex items-center gap-3 min-w-0">
          {onBackToMarkets ? (
            <button
              type="button"
              onClick={onBackToMarkets}
              className="p-2 rounded-lg border border-zinc-800/60 text-zinc-400 hover:text-white hover:bg-zinc-900 cursor-pointer shrink-0"
              title="Back to market scanner"
            >
              <ChevronLeft className="size-4" />
            </button>
          ) : null}
          <AssetLogoIcon symbol={symbol} size="lg" className="rounded-xl border border-zinc-800/60" />
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-white">{symbol}</h2>
            <p className="text-xs text-zinc-500 truncate">
              {ASSET_CATALOG[activeCategory]?.find((a) => a.symbol === symbol)?.name ?? symbol}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs terminal-num">
          <div>
            <span className="text-[8px] text-zinc-500 uppercase block">Spot</span>
            <span className="text-sm font-bold text-white">
              ${spot >= 1000 ? spot.toLocaleString(undefined, { maximumFractionDigits: 2 }) : spot.toFixed(3)}
            </span>
          </div>
          <div>
            <span className="text-[8px] text-zinc-500 uppercase block">Bid / Ask</span>
            <span className="text-xs text-zinc-300">
              ${activeQuoteBid.toFixed(2)} / ${activeQuoteAsk.toFixed(2)}
            </span>
          </div>
          <div>
            <span className={cn("text-xs font-bold flex items-center gap-0.5", change >= 0 ? "text-emerald-400" : "text-red-400")}>
              {change >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {change >= 0 ? "+" : ""}
              {change.toFixed(2)}%
            </span>
          </div>
          <button
            type="button"
            onClick={onAnalyzeWithAi}
            className="terminal-btn terminal-btn-primary text-[11px] uppercase tracking-wide"
          >
            <SparklesIcon className="size-3.5" />
            Analyze
          </button>
        </div>
      </section>

      <section className="terminal-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LineChart className="size-4 text-indigo-400" />
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Chart</h3>
          </div>
          <div className="flex gap-1 bg-zinc-900/40 border border-zinc-900/50 p-1 rounded-lg">
            {["5m", "15m", "1H", "4H", "1D", "1W", "1M"].map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setSelectedTimeframe(tf)}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-bold cursor-pointer",
                  selectedTimeframe === tf ? "bg-indigo-500/15 text-indigo-400" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-900/30 bg-zinc-950/20 p-2 min-h-[220px] flex items-center justify-center">
          {candlePoints.length > 0 ? (
            <SmoothAreaChart points={candlePoints} height={220} accent={change >= 0 ? "bullish" : "bearish"} />
          ) : (
            <div className="text-zinc-600 text-xs flex items-center gap-2">
              <RefreshCcwIcon className="size-4 animate-spin" />
              Loading chart...
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="terminal-card p-4 space-y-3">
          <span className="text-[10px] font-extrabold text-zinc-400 uppercase">CFD Ticket</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTradeDirection("BUY")}
              className={cn(
                "flex-1 py-2 rounded-lg text-xs font-bold border cursor-pointer flex items-center justify-center gap-1",
                tradeDirection === "BUY" ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400" : "border-zinc-900 text-zinc-500"
              )}
            >
              <ArrowUpIcon className="size-3.5" /> BUY
            </button>
            <button
              type="button"
              onClick={() => setTradeDirection("SELL")}
              className={cn(
                "flex-1 py-2 rounded-lg text-xs font-bold border cursor-pointer flex items-center justify-center gap-1",
                tradeDirection === "SELL" ? "bg-red-500/10 border-red-500/40 text-red-400" : "border-zinc-900 text-zinc-500"
              )}
            >
              <TrendingDown className="size-3.5" /> SELL
            </button>
          </div>
          <input
            type="number"
            min={0.001}
            step={0.01}
            value={tradeSize}
            onChange={(e) => setTradeSize(Math.max(0.001, Number(e.target.value)))}
            className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-3 py-2 text-xs terminal-num"
          />
          <div>
            <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
              <span>Leverage</span>
              <span className="text-indigo-400 font-bold">{tradeLeverage}x</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={tradeLeverage}
              onChange={(e) => setTradeLeverage(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>
          <button
            type="button"
            onClick={() =>
              onTradeExecute({
                id: "inline_" + Math.random().toString(36).slice(2, 9),
                symbol,
                direction: tradeDirection,
                price: spot,
                size: tradeSize,
                leverage: tradeLeverage,
                margin: (tradeSize * spot) / tradeLeverage,
                tp: null,
                sl: null,
                timestamp: Date.now(),
              })
            }
            className={cn(
              "w-full py-2.5 rounded-lg text-xs font-extrabold uppercase text-white flex items-center justify-center gap-2 cursor-pointer",
              tradeDirection === "BUY" ? "bg-emerald-600" : "bg-red-600"
            )}
          >
            <Zap className="size-4" />
            Place {tradeDirection}
          </button>
        </section>

        <section className="rounded-xl border border-zinc-900/60 bg-zinc-950/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase className="size-4 text-indigo-400" />
            <h3 className="text-xs font-extrabold text-white uppercase">Positions ({positions.length})</h3>
          </div>
          {positions.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-8">No open positions</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {positions.map((pos) => {
                const live = sidebarQuotes[pos.symbol]?.spot ?? pos.entryPrice;
                const pnl =
                  pos.direction === "BUY" ? (live - pos.entryPrice) * pos.size : (pos.entryPrice - live) * pos.size;
                return (
                  <div
                    key={pos.id}
                    className="p-3 rounded-lg border border-zinc-900/60 bg-zinc-950/60 flex justify-between items-center gap-2"
                  >
                    <div>
                      <span className="text-xs font-bold text-white">{pos.symbol}</span>
                      <span
                        className={cn(
                          "text-[9px] ml-2 font-bold",
                          pos.direction === "BUY" ? "text-emerald-400" : "text-red-400"
                        )}
                      >
                        {pos.direction}
                      </span>
                    </div>
                    <span className={cn("text-xs terminal-num font-bold", pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onClosePosition(pos.id)}
                      className="text-[9px] text-red-400 border border-red-500/20 px-2 py-1 rounded cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export function MarketsTab({
  activeSymbol,
  activeCategory,
  selectedTimeframe,
  setSelectedTimeframe,
  candlePoints,
  sidebarQuotes,
  positions,
  tradeDirection,
  setTradeDirection,
  tradeSize,
  setTradeSize,
  tradeLeverage,
  setTradeLeverage,
  activeQuoteSpot,
  activeQuoteBid,
  activeQuoteAsk,
  activeQuoteChange,
  onTradeExecute,
  onClosePosition,
  onAnalyzeWithAi,
  onCardClick,
  onSignalClick,
  symbolOverride,
  feedSignals = [],
  onOpenAssetTab,
  onBackToMarkets,
}: MarketsTabProps) {
  const symbol = symbolOverride ?? activeSymbol;

  const handleOpenAsset = (sym: string) => {
    onOpenAssetTab?.(sym);
  };

  if (!symbolOverride) {
    return (
      <MarketScannerView
        sidebarQuotes={sidebarQuotes}
        feedSignals={feedSignals}
        onOpenAsset={handleOpenAsset}
        onSignalClick={onSignalClick}
      />
    );
  }

  return (
    <AssetDetailView
      symbol={symbol}
      activeCategory={activeCategory}
      selectedTimeframe={selectedTimeframe}
      setSelectedTimeframe={setSelectedTimeframe}
      candlePoints={candlePoints}
      sidebarQuotes={sidebarQuotes}
      positions={positions}
      tradeDirection={tradeDirection}
      setTradeDirection={setTradeDirection}
      tradeSize={tradeSize}
      setTradeSize={setTradeSize}
      tradeLeverage={tradeLeverage}
      setTradeLeverage={setTradeLeverage}
      activeQuoteSpot={activeQuoteSpot}
      activeQuoteBid={activeQuoteBid}
      activeQuoteAsk={activeQuoteAsk}
      activeQuoteChange={activeQuoteChange}
      onTradeExecute={onTradeExecute}
      onClosePosition={onClosePosition}
      onAnalyzeWithAi={onAnalyzeWithAi}
      onBackToMarkets={onBackToMarkets}
    />
  );
}
