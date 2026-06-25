"use client";

import { useState } from "react";
import { BarChart3, Brain, List } from "lucide-react";
import { ChartProvider, useChartContext } from "@/contexts/chart-context";
import { cn } from "@/lib/utils";
import { AnalyticsEvents, captureEvent } from "@/lib/posthog/analytics";
import { AssetBrowser } from "./asset-browser";
import { ChartPanel } from "./chart-panel";
import { MarketsChatPanel } from "./markets-chat-panel";

type MobileMarketsPanel = "chart" | "assets" | "ai";

const MOBILE_PANELS: Array<{
  id: MobileMarketsPanel;
  label: string;
  icon: typeof BarChart3;
}> = [
  { id: "chart", label: "Chart", icon: BarChart3 },
  { id: "assets", label: "Assets", icon: List },
  { id: "ai", label: "AI", icon: Brain },
];

function MarketsTerminalInner() {
  const { aiPanelOpen, setAiPanelOpen, browserCollapsed, setBrowserCollapsed } =
    useChartContext();
  const [mobilePanel, setMobilePanel] = useState<MobileMarketsPanel>("chart");

  const showAssetsOnMobile = mobilePanel === "assets";
  const showChartOnMobile = mobilePanel === "chart";
  const showAiOnMobile = mobilePanel === "ai";

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--terminal-surface)]">
      <div
        className="flex shrink-0 border-b border-white/8 bg-black/30 lg:hidden"
        role="tablist"
        aria-label="Markets panels"
      >
        {MOBILE_PANELS.map(({ id, label, icon: Icon }) => {
          const selected = mobilePanel === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setMobilePanel(id);
                captureEvent(AnalyticsEvents.MARKETS_PANEL_CHANGED, { panel: id });
                if (id === "ai") setAiPanelOpen(true);
                if (id === "assets") setBrowserCollapsed(false);
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors",
                selected
                  ? "border-b-2 border-cyan-400 text-white"
                  : "border-b-2 border-transparent text-zinc-500",
              )}
            >
              <Icon className="size-3.5" strokeWidth={selected ? 2.25 : 1.85} />
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className={cn(
            "h-full min-h-0 shrink-0",
            showAssetsOnMobile ? "flex w-full flex-1" : "hidden",
            "lg:flex lg:w-auto lg:flex-none",
          )}
        >
          <AssetBrowser
            collapsed={browserCollapsed}
            onToggleCollapsed={() => setBrowserCollapsed(!browserCollapsed)}
            fullWidth
          />
        </div>

        <div
          className={cn(
            "min-h-0 min-w-0 flex-1",
            showChartOnMobile ? "flex" : "hidden",
            "lg:flex",
          )}
        >
          <ChartPanel />
        </div>

        <div
          className={cn(
            "h-full min-h-0 shrink-0",
            showAiOnMobile ? "flex w-full flex-1" : "hidden",
            "lg:flex lg:w-auto lg:flex-none",
          )}
        >
          <MarketsChatPanel
            open={aiPanelOpen || showAiOnMobile}
            onToggle={() => setAiPanelOpen(!aiPanelOpen)}
            fullWidth
            hideCollapseOnMobile
          />
        </div>
      </div>
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
