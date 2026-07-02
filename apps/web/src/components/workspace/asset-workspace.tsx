"use client";

import { useMemo } from "react";
import { ArrowLeft, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
import { ResizablePane } from "@/components/ui/resizable-pane";
import { TradingViewChart } from "@/components/generative-ui/tradingview-chart";
import type { EnrichedAsset } from "@/components/workspace/app-sections/home-section";
import {
  resolveStudies,
  resolveTradingViewSymbol,
  type TvInterval,
} from "@/lib/chart/tradingview-spec";

const TIMEFRAMES: Array<{ label: string; value: TvInterval }> = [
  { label: "1H", value: "60" },
  { label: "4H", value: "240" },
  { label: "1D", value: "D" },
  { label: "1W", value: "W" },
];

const INDICATOR_OPTIONS = ["RSI", "MACD", "Volume"] as const;

const INTERVAL_TO_RANGE: Record<string, string> = {
  "60": "1W",
  "240": "1M",
  D: "3M",
  W: "6M",
};

function formatPrice(val: number, symbol = "") {
  if (symbol.includes("USD") || symbol === "") {
    if (val < 1) return `$${val.toFixed(4)}`;
    if (val < 10) return `$${val.toFixed(3)}`;
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export interface AssetWorkspaceProps {
  asset: EnrichedAsset;
  spotPrice?: number;
  change24h?: number;
  interval: TvInterval;
  indicators: string[];
  onIntervalChange: (interval: TvInterval) => void;
  onIndicatorsChange: (indicators: string[]) => void;
  onClose: () => void;
  aiPanel: React.ReactNode;
}

export function AssetWorkspace({
  asset,
  spotPrice,
  change24h,
  interval,
  indicators,
  onIntervalChange,
  onIndicatorsChange,
  onClose,
  aiPanel,
}: AssetWorkspaceProps) {
  const price = spotPrice ?? asset.spotPrice;
  const change = change24h ?? asset.change24h;
  const isUp = change >= 0;

  const tvSymbol = useMemo(() => resolveTradingViewSymbol(asset.symbol), [asset.symbol]);
  const tvStudies = useMemo(() => resolveStudies(indicators), [indicators]);
  const chartRange = INTERVAL_TO_RANGE[interval] ?? "3M";

  const activeIndicators = useMemo(() => new Set(indicators.map((i) => i.toUpperCase())), [indicators]);

  const toggleIndicator = (name: string) => {
    const upper = name.toUpperCase();
    if (activeIndicators.has(upper)) {
      onIndicatorsChange(indicators.filter((i) => i.toUpperCase() !== upper));
    } else {
      onIndicatorsChange([...indicators, name]);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--terminal-surface)]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-black/30 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-white"
            aria-label="Back to market console"
          >
            <ArrowLeft className="size-4" />
          </button>
          <AssetLogoIcon
            symbol={asset.symbol}
            assetClass={asset.asset_class}
            sector={asset.sector}
            size="sm"
            className="rounded-full"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-base font-black text-white">{asset.symbol}</h1>
              <span className="truncate text-xs text-zinc-500">{asset.name}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-sm font-bold text-white">{formatPrice(price, asset.symbol)}</span>
              <span
                className={cn(
                  "flex items-center gap-0.5 text-xs font-bold",
                  isUp ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]",
                )}
              >
                {isUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {isUp ? "+" : ""}
                {change.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                type="button"
                onClick={() => onIntervalChange(tf.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
                  interval === tf.value
                    ? "bg-cyan-500/20 text-cyan-300"
                    : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <div className="hidden items-center gap-1 sm:flex">
            {INDICATOR_OPTIONS.map((ind) => (
              <button
                key={ind}
                type="button"
                onClick={() => toggleIndicator(ind)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-colors",
                  activeIndicators.has(ind)
                    ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                    : "border-white/[0.08] text-zinc-500 hover:text-zinc-300",
                )}
              >
                {ind}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-b border-white/[0.06] lg:border-b-0 lg:border-r">
          <div className="min-h-0 flex-1 overflow-hidden bg-black">
            <TradingViewChart
              key={`${tvSymbol}-${interval}-${tvStudies.join(",")}`}
              symbol={tvSymbol}
              displayName={`${asset.symbol} · ${asset.name}`}
              interval={interval}
              indicators={tvStudies}
              range={chartRange}
              variant="terminal"
              theme="dark"
              style="candles"
            />
          </div>
        </div>

        <ResizablePane
          minWidth={320}
          maxWidth={560}
          defaultWidth={380}
          side="right"
          className="flex min-h-[280px] w-full shrink-0 flex-col border-white/[0.06] bg-black/20 lg:min-h-0 lg:w-auto lg:border-l"
        >
          {aiPanel}
        </ResizablePane>
      </div>
    </div>
  );
}
