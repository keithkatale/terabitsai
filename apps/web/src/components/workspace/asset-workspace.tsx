"use client";

import { useMemo } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Eraser,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
import { ResizablePane } from "@/components/ui/resizable-pane";
import { AnnotatedPriceChart } from "@/components/chart/annotated-price-chart";
import type { EnrichedAsset } from "@/components/workspace/app-sections/home-section";
import type { TvInterval } from "@/lib/chart/tradingview-spec";
import { useChartDrawings } from "@/contexts/chart-drawings-context";

const TIMEFRAMES: Array<{ label: string; value: TvInterval }> = [
  { label: "1H", value: "60" },
  { label: "4H", value: "240" },
  { label: "1D", value: "D" },
  { label: "1W", value: "W" },
];

const INDICATOR_OPTIONS = ["RSI", "MACD", "Volume"] as const;

const PROMPT_CHIPS = [
  "Mark support and resistance",
  "Find a high-conviction entry",
  "Should I be bullish on this?",
  "Draw my stop and target",
] as const;

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
  onPromptChip: (prompt: string) => void;
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
  onPromptChip,
  aiPanel,
}: AssetWorkspaceProps) {
  const { overlayVisible, setOverlayVisible, clearDrawings } = useChartDrawings();
  const price = spotPrice ?? asset.spotPrice;
  const change = change24h ?? asset.change24h;
  const isUp = change >= 0;

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

          <button
            type="button"
            onClick={() => setOverlayVisible(!overlayVisible)}
            className="flex size-8 items-center justify-center rounded-lg border border-white/[0.08] text-zinc-400 hover:text-white"
            title={overlayVisible ? "Hide AI drawings" : "Show AI drawings"}
          >
            {overlayVisible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => clearDrawings(asset.symbol)}
            className="flex size-8 items-center justify-center rounded-lg border border-white/[0.08] text-zinc-400 hover:text-white"
            title="Clear AI drawings"
          >
            <Eraser className="size-3.5" />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-white/[0.06] p-3 lg:border-b-0 lg:border-r lg:p-4">
          <AnnotatedPriceChart
            symbol={asset.symbol}
            interval={interval}
            className="min-h-[240px] flex-1 rounded-xl border border-white/[0.06] bg-black/50"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {PROMPT_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => onPromptChip(chip)}
                className="terminal-btn terminal-btn-ghost rounded-full px-3 py-1 text-[10px] font-semibold text-zinc-400 hover:text-cyan-300"
              >
                {chip}
              </button>
            ))}
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
