"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AssetComparativeChart } from "@/components/generative-ui/asset-comparative-chart";

type ComparePoint = { time: string; val1: number; val2: number };

export function QuantCompareChart({
  symbol1,
  symbol2,
  range = "6M",
}: {
  symbol1: string;
  symbol2: string;
  range?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ComparePoint[]>([]);
  const [labels, setLabels] = useState({ t1: symbol1, t2: symbol2 });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/market/chart?symbol=${encodeURIComponent(symbol1)}&range=${range}`).then((r) => r.json()),
      fetch(`/api/market/chart?symbol=${encodeURIComponent(symbol2)}&range=${range}`).then((r) => r.json()),
    ])
      .then(([a, b]) => {
        if (cancelled) return;
        if (!a.success || !b.success) {
          setError(a.error ?? b.error ?? "Comparison failed");
          setLoading(false);
          return;
        }

        const aCandles = a.candles ?? [];
        const bCandles = b.candles ?? [];
        const len = Math.min(aCandles.length, bCandles.length);
        const points: ComparePoint[] = [];
        for (let i = Math.max(0, len - 120); i < len; i++) {
          points.push({
            time: new Date((aCandles[i]?.t ?? 0) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            val1: aCandles[i]?.c ?? 0,
            val2: bCandles[i]?.c ?? 0,
          });
        }
        setData(points);
        setLabels({ t1: a.display_name ?? symbol1, t2: b.display_name ?? symbol2 });
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Comparison failed");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [symbol1, symbol2, range]);

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-zinc-800/60 bg-zinc-950/40">
        <Loader2 className="size-5 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-950/10 p-4 text-xs text-rose-300">
        Could not load comparison: {error ?? "No data"}
      </div>
    );
  }

  return (
    <AssetComparativeChart
      ticker1={labels.t1}
      ticker2={labels.t2}
      range={range}
      data={data}
      dataSource="capital.com"
    />
  );
}
