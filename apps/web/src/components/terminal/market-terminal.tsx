"use client";

import { useEffect } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketTerminalProps, TerminalTabId } from "./types";
import { GlobalTickerStrip } from "./global-ticker-strip";
import { AccountTab } from "./terminal-tabs/account-tab";
import { MarketsTab } from "./terminal-tabs/markets-tab";
import { IntelligenceTab } from "./terminal-tabs/intelligence-tab";
import { NewsTab } from "./terminal-tabs/news-tab";
import { SectorsTab } from "./terminal-tabs/sectors-tab";

const BASE_TABS: { id: TerminalTabId; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "markets", label: "Markets" },
  { id: "intelligence", label: "Intelligence" },
  { id: "news", label: "News" },
  { id: "sectors", label: "Sectors" },
];

export function MarketTerminal({
  activeTab,
  setActiveTab,
  pinnedAssetTabs,
  onOpenAssetTab,
  onCloseAssetTab,
  sectorFeedSignals,
  setSectorFeedSignals,
  ...props
}: MarketTerminalProps & {
  activeTab: TerminalTabId;
  setActiveTab: (t: TerminalTabId) => void;
  pinnedAssetTabs: string[];
  onOpenAssetTab: (symbol: string) => void;
  onCloseAssetTab: (symbol: string) => void;
  sectorFeedSignals: Array<{ symbol: string; strategy: string; action: string; reason: string; sector?: string | null }>;
  setSectorFeedSignals: (s: typeof sectorFeedSignals) => void;
}) {
  const tabs = [
    ...BASE_TABS,
    ...pinnedAssetTabs.map((sym) => ({ id: `asset:${sym}` as TerminalTabId, label: sym })),
  ];

  const assetSymbol = activeTab.startsWith("asset:") ? activeTab.slice(6) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const map: Record<string, TerminalTabId> = {
        "1": "account",
        "2": "markets",
        "3": "intelligence",
        "4": "news",
        "5": "sectors"
      };
      if (map[e.key]) {
        e.preventDefault();
        setActiveTab(map[e.key]);
      }
      if (e.key === "/") {
        e.preventDefault();
        setActiveTab("intelligence");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setActiveTab, props]);

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-[#050508] overflow-hidden">
      <GlobalTickerStrip
        sidebarQuotes={props.sidebarQuotes}
        onSymbolClick={(sym) => {
          props.onSymbolFromFeed(sym);
          onOpenAssetTab(sym);
        }}
      />

      <div className="shrink-0 flex items-center gap-1 px-3 py-2 border-b border-zinc-900/60 bg-zinc-950/40 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "terminal-tab shrink-0 px-3 py-1.5 text-[10px]",
              activeTab === tab.id ? "terminal-tab-active" : "terminal-tab-idle",
            )}
          >
            {tab.label}
            {tab.id.startsWith("asset:") ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseAssetTab(tab.label);
                }}
                className="ml-1.5 text-zinc-600 hover:text-white"
              >
                ×
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {activeTab === "account" ? <AccountTab {...props} /> : null}
        {activeTab === "markets" ? (
          <MarketsTab
            {...props}
            feedSignals={sectorFeedSignals}
            onOpenAssetTab={onOpenAssetTab}
          />
        ) : null}
        {activeTab === "intelligence" ? (
          <IntelligenceTab
            {...props}
            onFeedLoaded={setSectorFeedSignals}
            onSymbolFromFeed={(sym) => {
              props.onSymbolFromFeed(sym);
              onOpenAssetTab(sym);
            }}
            onSignalClick={(sig) => {
              props.onSignalClick(sig);
              onOpenAssetTab(sig.symbol);
            }}
          />
        ) : null}
        {activeTab === "news" ? <NewsTab activeSymbol={props.activeSymbol} /> : null}
        {activeTab === "sectors" ? (
          <SectorsTab
            sidebarQuotes={props.sidebarQuotes}
            activeSymbol={props.activeSymbol}
            onSymbolClick={(sym) => {
              props.onSymbolFromFeed(sym);
              onOpenAssetTab(sym);
            }}
            feedSignals={sectorFeedSignals}
          />
        ) : null}
        {assetSymbol ? (
          <MarketsTab
            {...props}
            symbolOverride={assetSymbol}
            onOpenAssetTab={onOpenAssetTab}
            onBackToMarkets={() => setActiveTab("markets")}
          />
        ) : null}
      </div>
    </div>
  );
}
