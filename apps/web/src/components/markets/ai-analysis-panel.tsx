"use client";

import {
  Brain,
  ChevronRight,
  Loader2,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useChartAnalysis } from "@/hooks/use-chart-analysis";
import { useChartContext } from "@/contexts/chart-context";
import { cn } from "@/lib/utils";

function BiasBadge({ bias, confidence }: { bias?: string; confidence?: number }) {
  if (!bias) return null;
  const BIAS_CONFIG = {
    bullish: {
      icon: TrendingUp,
      label: "Bullish",
      className: "text-emerald-400 bg-emerald-950/40 border-emerald-500/20",
    },
    bearish: {
      icon: TrendingDown,
      label: "Bearish",
      className: "text-rose-400 bg-rose-950/40 border-rose-500/20",
    },
    neutral: {
      icon: Minus,
      label: "Neutral",
      className: "text-zinc-400 bg-zinc-900/40 border-zinc-700/30",
    },
  } as const;
  const config =
    BIAS_CONFIG[bias as keyof typeof BIAS_CONFIG] ?? BIAS_CONFIG.neutral;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        config.className,
      )}
    >
      <Icon className="size-3" />
      {config.label}
      {confidence != null ? ` · ${confidence}%` : ""}
    </span>
  );
}

export function AiAnalysisPanel({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const { symbol, displayName, interval, indicators } = useChartContext();
  const { status, analysis, reasoningText, error, refresh } = useChartAnalysis({
    symbol,
    interval,
    indicators,
    enabled: open,
  });

  if (!open) {
    return (
      <div className="flex h-full w-10 shrink-0 flex-col items-center border-l border-white/6 bg-black/30 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="rounded-lg p-2 text-cyan-400 hover:bg-cyan-500/10"
          title="Open AI analysis"
        >
          <Brain className="size-4" />
        </button>
      </div>
    );
  }

  const loading = status === "loading" || status === "streaming";

  return (
    <aside className="flex h-full w-[min(340px,36vw)] shrink-0 flex-col border-l border-white/6 bg-black/30">
      <div className="flex items-center justify-between gap-2 border-b border-white/6 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-cyan-400" />
          <div>
            <p className="text-xs font-bold text-white">AI Analysis</p>
            <p className="text-[10px] text-zinc-500">{symbol}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="rounded-lg p-1.5 text-zinc-500 hover:text-cyan-400 disabled:opacity-40"
            title="Refresh analysis"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg p-1.5 text-zinc-500 hover:text-zinc-300"
            title="Collapse panel"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {loading && !analysis?.summary ? (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Loader2 className="size-4 animate-spin text-cyan-400" />
            Analyzing {displayName}…
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-rose-500/20 bg-rose-950/20 px-3 py-2 text-xs text-rose-300">
            {error}
          </p>
        ) : null}

        {analysis?.bias ? (
          <div className="mb-3">
            <BiasBadge bias={analysis.bias} confidence={analysis.confidence} />
          </div>
        ) : null}

        {analysis?.summary ? (
          <section className="mb-4">
            <h3 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Thesis
            </h3>
            <p className="text-sm leading-relaxed text-zinc-200">{analysis.summary}</p>
          </section>
        ) : null}

        {analysis?.keyLevels && analysis.keyLevels.length > 0 ? (
          <section className="mb-4">
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Key Levels
            </h3>
            <ul className="space-y-1.5">
              {analysis.keyLevels.map((lvl, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-white/6 bg-white/[0.02] px-2.5 py-1.5 text-xs"
                >
                  <span className="font-mono text-zinc-200">{lvl.price}</span>
                  <span className="text-[10px] uppercase text-zinc-500">{lvl.type}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {analysis?.patterns && analysis.patterns.length > 0 ? (
          <section className="mb-4">
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Patterns
            </h3>
            <div className="flex flex-wrap gap-1">
              {analysis.patterns.map((p) => (
                <span
                  key={p}
                  className="rounded-lg border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-300"
                >
                  {p}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {analysis?.indicatorReads && analysis.indicatorReads.length > 0 ? (
          <section className="mb-4">
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Indicators
            </h3>
            <ul className="space-y-2">
              {analysis.indicatorReads.map((ind, i) => (
                <li key={i} className="text-xs">
                  <span className="font-semibold text-cyan-400">{ind.name}</span>
                  <span className="text-zinc-500"> — </span>
                  <span className="text-zinc-300">{ind.read}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {analysis?.confirmation || analysis?.invalidation ? (
          <section className="mb-4 grid gap-2">
            {analysis.invalidation ? (
              <div className="rounded-xl border border-rose-500/15 bg-rose-950/10 px-3 py-2">
                <p className="text-[9px] font-bold uppercase text-rose-400">Invalidation</p>
                <p className="mt-0.5 text-xs text-zinc-300">{analysis.invalidation}</p>
              </div>
            ) : null}
            {analysis.confirmation ? (
              <div className="rounded-xl border border-emerald-500/15 bg-emerald-950/10 px-3 py-2">
                <p className="text-[9px] font-bold uppercase text-emerald-400">Confirmation</p>
                <p className="mt-0.5 text-xs text-zinc-300">{analysis.confirmation}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        {reasoningText ? (
          <section>
            <h3 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Deep Dive
            </h3>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-400">
              {reasoningText}
              {status === "streaming" ? (
                <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-cyan-400" />
              ) : null}
            </p>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
