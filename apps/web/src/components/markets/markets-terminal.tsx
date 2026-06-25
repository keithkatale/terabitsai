"use client";

import { ChartProvider, useChartContext } from "@/contexts/chart-context";
import { AssetBrowser } from "./asset-browser";
import { ChartPanel } from "./chart-panel";
import { MarketsChatPanel } from "./markets-chat-panel";

function MarketsTerminalInner() {
  const { aiPanelOpen, setAiPanelOpen, browserCollapsed, setBrowserCollapsed } =
    useChartContext();

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-[var(--terminal-surface)]">
      <AssetBrowser
        collapsed={browserCollapsed}
        onToggleCollapsed={() => setBrowserCollapsed(!browserCollapsed)}
      />
      <ChartPanel />
      <MarketsChatPanel open={aiPanelOpen} onToggle={() => setAiPanelOpen(!aiPanelOpen)} />
    </div>
  );
}

export function MarketsTerminal() {
  return (
    <ChartProvider>
      <MarketsTerminalInner />
    </ChartProvider>
  );
}
