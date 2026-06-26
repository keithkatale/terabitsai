"use client";

import { useCallback, useState } from "react";
import { TradingViewChart } from "@/components/generative-ui/tradingview-chart";
import { useChartContext } from "@/contexts/chart-context";
import { useChartAnalysis } from "@/hooks/use-chart-analysis";
import { AiAnalysisPanel } from "./ai-analysis-panel";
import { ChartToolbar } from "./chart-toolbar";
import { AnalyticsEvents, captureEvent } from "@/lib/posthog/analytics";

export function ChartPanel() {
  const {
    symbol,
    tvSymbol,
    displayName,
    interval,
    indicators,
    aiPanelOpen,
    setAiPanelOpen,
    setInterval,
  } = useChartContext();

  const [analysisOpen, setAnalysisOpen] = useState(false);

  const {
    status,
    analysis,
    reasoningText,
    error,
    snapshotUrl,
    genui,
    runAnalysis,
    refresh,
  } = useChartAnalysis({
    symbol,
    interval,
    indicators,
    autoRun: false,
  });

  const analyzing = status === "loading" || status === "streaming";

  const handleAnalyze = useCallback(() => {
    setAnalysisOpen(true);
    captureEvent(AnalyticsEvents.CHART_ANALYZED, { symbol, interval });
    void runAnalysis({ bypassCache: true });
  }, [runAnalysis, symbol, interval]);

  return (
    <div className="flex min-w-0 w-full max-w-full flex-1 overflow-hidden bg-zinc-950">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <ChartToolbar
          displayName={displayName}
          symbol={symbol}
          interval={interval}
          onIntervalChange={setInterval}
          onAnalyze={handleAnalyze}
          analyzing={analyzing}
          onToggleChat={() => setAiPanelOpen(!aiPanelOpen)}
          chatOpen={aiPanelOpen}
        />
        <div className="relative min-h-0 flex-1">
          <TradingViewChart symbol={tvSymbol} variant="terminal" />
        </div>
      </div>

      <AiAnalysisPanel
        open={analysisOpen}
        onToggle={() => setAnalysisOpen((v) => !v)}
        symbol={symbol}
        displayName={displayName}
        status={status}
        analysis={analysis}
        reasoningText={reasoningText}
        error={error}
        snapshotUrl={snapshotUrl}
        genui={genui}
        onRefresh={() => void refresh()}
      />
    </div>
  );
}
