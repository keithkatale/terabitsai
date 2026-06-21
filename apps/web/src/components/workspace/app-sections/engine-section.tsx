"use client";

import { useEffect, useState } from "react";
import { Activity, Cpu, Loader2 } from "lucide-react";
import { AgentActivityFeed, useAgentActivityStream } from "@/components/terminal/agent-activity-feed";
import { IntelligenceTab } from "@/components/terminal/terminal-tabs/intelligence-tab";
import { NewsSection } from "@/components/workspace/app-sections/news-section";
import type { LiveSignal } from "@/lib/market/market-intel-data";

type EngineStatus = {
  mode: "idle" | "running" | "scanning";
  lastOparCycleAt: string | null;
  lastIntelScanAt: string | null;
};

export function EngineSection({
  enabled,
  sidebarQuotes,
  activeSymbol,
  onSignalClick,
  onSymbolFromFeed,
  onAskAi,
  onIntelSymbolClick,
  onOpenMarkets,
}: {
  enabled: boolean;
  sidebarQuotes: Record<string, { spot?: number; change24hPct?: number }>;
  activeSymbol: string;
  onSignalClick: (sig: LiveSignal) => void;
  onSymbolFromFeed: (symbol: string) => void;
  onAskAi: (prompt: string) => void;
  onIntelSymbolClick: (symbol: string) => void;
  onOpenMarkets: (symbol: string) => void;
}) {
  const events = useAgentActivityStream();
  const [status, setStatus] = useState<EngineStatus | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/engine/status", { credentials: "include" });
        if (!res.ok || cancelled) return;
        setStatus((await res.json()) as EngineStatus);
      } catch {
        // Non-fatal
      }
    };

    void load();
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-zinc-900/60 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="size-4 text-indigo-400" />
            <div>
              <h1 className="text-sm font-extrabold text-white">Engine</h1>
              <p className="text-[11px] text-zinc-500">
                Agent activity, intel inputs, and trading signals for your Wealth Engine.
              </p>
            </div>
          </div>
          <div className="text-right text-[10px] text-zinc-500">
            {status?.mode === "running" ? (
              <span className="inline-flex items-center gap-1 text-amber-300">
                <Loader2 className="size-3 animate-spin" />
                OPAR running
              </span>
            ) : status?.mode === "scanning" ? (
              <span className="text-indigo-300">Intel scan active</span>
            ) : (
              <span>Engine idle</span>
            )}
            {status?.lastOparCycleAt ? (
              <p className="mt-0.5">Last cycle {new Date(status.lastOparCycleAt).toLocaleString()}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden xl:grid-cols-2">
        <div className="flex min-h-0 flex-col border-b border-zinc-900/60 xl:border-b-0 xl:border-r">
          <div className="flex items-center gap-2 border-b border-zinc-900/60 px-4 py-2">
            <Activity className="size-3.5 text-emerald-400" />
            <h2 className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-300">
              Agent activity
            </h2>
          </div>
          <div className="min-h-[220px] flex-1 overflow-hidden bg-zinc-950/30">
            <AgentActivityFeed events={events} className="h-full" maxVisible={40} />
          </div>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden">
          <NewsSection
            enabled={enabled}
            variant="intel"
            onSymbolClick={onIntelSymbolClick}
          />
        </div>
      </div>

      <div className="shrink-0 border-t border-zinc-900/60">
        <IntelligenceTab
          enabled={enabled}
          sidebarQuotes={sidebarQuotes}
          activeSymbol={activeSymbol}
          onSignalClick={(sig) => {
            onSignalClick(sig);
            onOpenMarkets(sig.symbol);
          }}
          onSymbolFromFeed={onSymbolFromFeed}
          onAskAi={onAskAi}
        />
      </div>
    </div>
  );
}
