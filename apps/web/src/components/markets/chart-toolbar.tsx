"use client";

import { Loader2, MessageSquare, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TvInterval } from "@/lib/chart/tradingview-spec";
import { TimeframeSelector } from "./timeframe-selector";

export function ChartToolbar({
  displayName,
  symbol,
  interval,
  onIntervalChange,
  onAnalyze,
  analyzing,
  onToggleChat,
  chatOpen,
}: {
  displayName: string;
  symbol: string;
  interval: TvInterval;
  onIntervalChange: (interval: TvInterval) => void;
  onAnalyze: () => void;
  analyzing: boolean;
  onToggleChat: () => void;
  chatOpen: boolean;
}) {
  return (
    <div className="flex w-full max-w-full shrink-0 flex-wrap items-center gap-2 overflow-hidden border-b border-white/6 bg-black/40 px-3 py-2">
      <div className="mr-1 min-w-0 basis-full sm:basis-auto">
        <p className="truncate text-xs font-semibold text-white">{displayName}</p>
        <p className="font-mono text-[10px] text-zinc-500">{symbol}</p>
      </div>

      <div className="hidden h-6 w-px bg-white/10 sm:block" />

      <div className="order-3 w-full min-w-0 overflow-x-auto sm:order-none sm:w-auto sm:flex-1 sm:overflow-visible">
        <TimeframeSelector
          value={interval}
          onChange={onIntervalChange}
          className="w-max min-w-full flex-nowrap sm:min-w-0 sm:flex-wrap"
        />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onAnalyze}
          disabled={analyzing}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition",
            analyzing
              ? "border-cyan-500/20 bg-cyan-500/5 text-cyan-300/70"
              : "border-cyan-500/35 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25",
          )}
          title="Run AI chart analysis (TradingView + vision)"
        >
          {analyzing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          <span className="hidden sm:inline">{analyzing ? "Analyzing…" : "Analyze chart"}</span>
        </button>

        <button
          type="button"
          onClick={onToggleChat}
          className={cn(
            "hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition lg:inline-flex",
            chatOpen
              ? "border-violet-500/30 bg-violet-500/10 text-violet-200"
              : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200",
          )}
          title="Open AI chat for this chart"
        >
          <MessageSquare className="size-3.5" />
          <span className="hidden sm:inline">Ask AI</span>
        </button>
      </div>
    </div>
  );
}
