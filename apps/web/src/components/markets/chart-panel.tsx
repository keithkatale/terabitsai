"use client";

import { TradingViewChart } from "@/components/generative-ui/tradingview-chart";
import { useChartContext } from "@/contexts/chart-context";

export function ChartPanel() {
  const { tvSymbol } = useChartContext();

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-zinc-950">
      <TradingViewChart symbol={tvSymbol} variant="terminal" />
    </div>
  );
}
