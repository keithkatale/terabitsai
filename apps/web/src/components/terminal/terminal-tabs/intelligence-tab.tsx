"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Radar, Sparkles } from "lucide-react";
import { CatalystRadar } from "@/components/market/catalyst-radar";
import { ConvictionDashboardStrip } from "@/components/market/conviction-dashboard";
import { SynthesisCard } from "@/components/market/synthesis-card";
import { SmartMoneyTracker } from "@/components/market/smart-money-tracker";
import { SignalsOpportunitiesPanel } from "@/components/market/signals-opportunities-panel";
import type { CatalystRadarItem, SynthesisBrief } from "@quant/contracts";
import type { LiveSignal } from "@/lib/market/market-intel-data";
import type { MarketTerminalProps } from "../types";

type IntelFeedItem =
  | { kind: "signal"; item: Record<string, unknown>; at: string }
  | { kind: "news"; item: Record<string, unknown>; at: string }
  | { kind: "opportunity"; item: Record<string, unknown>; at: string };

type IntelSubView = "radar" | "feed" | "flow";
type BootstrapStatus = "idle" | "scanning" | "running" | "ready" | "error";

export function IntelligenceTab(
  props: Pick<
    MarketTerminalProps,
    "sidebarQuotes" | "activeSymbol" | "onSignalClick" | "onSymbolFromFeed" | "onAskAi"
  > & {
    onFeedLoaded?: (signals: Array<{ symbol: string; strategy: string; action: string; reason: string; sector?: string | null }>) => void;
  }
) {
  const [subView, setSubView] = useState<IntelSubView>("radar");
  const [radar, setRadar] = useState<CatalystRadarItem[]>([]);
  const [briefs, setBriefs] = useState<SynthesisBrief[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState(props.activeSymbol);
  const [feedItems, setFeedItems] = useState<IntelFeedItem[]>([]);
  const [status, setStatus] = useState<BootstrapStatus>("idle");
  const [counts, setCounts] = useState<{ signals: number; news: number } | null>(null);

  const applyPayload = useCallback(
    (data: {
      items?: IntelFeedItem[];
      radar?: CatalystRadarItem[];
      briefs?: SynthesisBrief[];
      status?: BootstrapStatus;
      counts?: { signals: number; news: number };
    }) => {
      if (data.status) setStatus(data.status);
      if (data.counts) setCounts(data.counts);
      if (Array.isArray(data.radar)) setRadar(data.radar);
      if (Array.isArray(data.briefs)) setBriefs(data.briefs);
      if (Array.isArray(data.items)) {
        setFeedItems(data.items);
        const signals = data.items
          .filter((i) => i.kind === "signal")
          .map((i) => i.item as { symbol: string; strategy: string; action: string; reason: string; sector?: string });
        props.onFeedLoaded?.(signals);
      }
    },
    [props]
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/intel/bootstrap");
      const data = await res.json();
      if (data?.success) applyPayload(data);
      else setStatus("error");
    } catch {
      setStatus("error");
    }
  }, [applyPayload]);

  useEffect(() => {
    load();
    const pollMs = status === "scanning" || status === "running" ? 8000 : 30_000;
    const t = setInterval(load, pollMs);
    return () => clearInterval(t);
  }, [load, status]);

  const handleSymbolClick = (sym: string) => {
    setSelectedSymbol(sym);
    props.onSymbolFromFeed(sym);
  };

  const selectedBrief = briefs.find((b) => b.symbols.includes(selectedSymbol) && b.briefType === "catalyst");
  const isAnalyzing = status === "scanning" || status === "running" || status === "idle";
  const hasLiveData = feedItems.length > 0 || radar.length > 0 || briefs.length > 0;

  const liveSignals: LiveSignal[] = feedItems
    .filter((i) => i.kind === "signal")
    .map((i, idx) => {
      const s = i.item as Record<string, unknown>;
      return {
        id: String(s.id ?? idx),
        symbol: String(s.symbol ?? ""),
        name: String(s.symbol ?? ""),
        assetClass: String(s.assetClass ?? "stock"),
        sector: s.sector ? String(s.sector) : undefined,
        action: (s.action === "SELL" ? "SELL" : "BUY") as "BUY" | "SELL",
        strategy: String(s.strategy ?? "").replace(/_/g, " "),
        timeframe: (String(s.timeframe ?? "1H") as LiveSignal["timeframe"]) || "1H",
        reason: String(s.reason ?? ""),
        change24h: 0,
      };
    });

  return (
    <div className="flex flex-col h-full min-h-0">
      <ConvictionDashboardStrip />

      {isAnalyzing && !hasLiveData ? (
        <div className="shrink-0 mx-3 mt-3 terminal-card-raised p-4 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/25">
            <Loader2 className="size-5 text-indigo-400 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Analyzing market data…</p>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Scanning 12 core assets for signals, catalysts, and news. Live feed updates as results arrive — typically
              1–3 minutes.
            </p>
          </div>
        </div>
      ) : null}

      {hasLiveData && isAnalyzing ? (
        <div className="shrink-0 mx-3 mt-2 px-3 py-2 rounded-xl border border-indigo-500/20 bg-indigo-500/8 flex items-center gap-2">
          <Sparkles className="size-3.5 text-indigo-400 animate-pulse" />
          <span className="text-[11px] text-indigo-200/90 font-medium">
            Live feed updating{counts ? ` · ${counts.signals} signals, ${counts.news} headlines` : ""}
          </span>
        </div>
      ) : null}

      <div className="shrink-0 flex gap-1.5 px-3 py-2 border-b border-zinc-900/60">
        {(["radar", "feed", "flow"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setSubView(v)}
            className={`terminal-tab ${subView === v ? "terminal-tab-active" : "terminal-tab-idle"}`}
          >
            {v === "radar" ? "Catalyst Radar" : v === "feed" ? "Live Feed" : "Smart Money"}
          </button>
        ))}
      </div>

      {subView === "radar" ? (
        <div className="flex-1 overflow-y-auto min-h-0 space-y-3 p-3">
          {radar.length === 0 && !isAnalyzing ? (
            <div className="terminal-card p-6 text-center">
              <Radar className="size-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-zinc-400">No catalyst data yet. Analysis will populate this view shortly.</p>
            </div>
          ) : (
            <CatalystRadar items={radar} onSymbolClick={handleSymbolClick} selectedSymbol={selectedSymbol} />
          )}
          {selectedBrief ? (
            <SynthesisCard
              brief={selectedBrief}
              onSymbolClick={handleSymbolClick}
              stale={selectedBrief.expiresAt ? new Date(selectedBrief.expiresAt) < new Date() : false}
            />
          ) : null}
          {briefs
            .filter((b) => b.briefType === "contradiction")
            .slice(0, 3)
            .map((b) => (
              <SynthesisCard key={b.id} brief={b} onSymbolClick={handleSymbolClick} />
            ))}
        </div>
      ) : null}

      {subView === "flow" ? (
        <div className="flex-1 overflow-y-auto min-h-0 p-3">
          <SmartMoneyTracker onSymbolClick={handleSymbolClick} />
        </div>
      ) : null}

      {subView === "feed" ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <SignalsOpportunitiesPanel
            sidebarQuotes={props.sidebarQuotes}
            onSignalClick={props.onSignalClick}
            onSymbolClick={props.onSymbolFromFeed}
            onAskAi={props.onAskAi}
            externalSignals={liveSignals}
            dbItems={feedItems}
            loading={isAnalyzing && feedItems.length === 0}
            liveOnly
          />
        </div>
      ) : null}
    </div>
  );
}
