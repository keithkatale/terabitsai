"use client";

import { Zap } from "lucide-react";
import { IntelligenceTab } from "@/components/terminal/terminal-tabs/intelligence-tab";
import type { LiveSignal } from "@/lib/market/market-intel-data";

export function SignalsSection({
  sidebarQuotes,
  activeSymbol,
  onSignalClick,
  onSymbolClick,
  onAskAi,
  onFeedLoaded,
  enabled = true,
}: {
  sidebarQuotes: Record<string, { spot?: number; change24hPct?: number }>;
  activeSymbol: string;
  onSignalClick: (sig: LiveSignal) => void;
  onSymbolClick: (symbol: string) => void;
  onAskAi: (prompt: string) => void;
  enabled?: boolean;
  onFeedLoaded?: (
    signals: Array<{
      symbol: string;
      strategy: string;
      action: string;
      reason: string;
      sector?: string | null;
    }>,
  ) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#050508]">
      <div className="shrink-0 border-b border-zinc-900/60 px-4 py-4">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-amber-400" />
          <div>
            <h1 className="text-sm font-extrabold text-white">Signals</h1>
            <p className="text-[11px] text-zinc-500">
              Live AI trading signals, catalyst radar, and market intelligence feed.
            </p>
          </div>
        </div>
      </div>
      <IntelligenceTab
        enabled={enabled}
        sidebarQuotes={sidebarQuotes}
        activeSymbol={activeSymbol}
        onSignalClick={onSignalClick}
        onSymbolFromFeed={onSymbolClick}
        onAskAi={onAskAi}
        onFeedLoaded={onFeedLoaded}
      />
    </div>
  );
}
