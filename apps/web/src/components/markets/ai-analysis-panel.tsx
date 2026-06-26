"use client";

import {
  ChevronRight,
  Loader2,
  Minus,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { GenUiRenderer } from "@/components/generative-ui/genui-renderer";
import type { AnalysisStreamState } from "@/hooks/use-chart-analysis";
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
  symbol,
  displayName,
  status,
  analysis,
  reasoningText,
  error,
  snapshotUrl,
  genui,
  onRefresh,
}: {
  open: boolean;
  onToggle: () => void;
  symbol: string;
  displayName: string;
} & Pick<
  AnalysisStreamState,
  "status" | "analysis" | "reasoningText" | "error" | "snapshotUrl" | "genui"
> & {
  onRefresh: () => void;
}) {
  if (!open) {
    return (
      <div className="hidden h-full w-10 shrink-0 flex-col items-center border-l border-white/6 bg-black/30 py-3 lg:flex">
        <button
          type="button"
          onClick={onToggle}
          className="rounded-lg p-2 text-cyan-400 hover:bg-cyan-500/10"
          title="Open chart analysis"
        >
          <Sparkles className="size-4" />
        </button>
      </div>
    );
  }

  const loading = status === "loading" || status === "streaming";
  const idle = status === "idle";

  return (
    <>
      <button
        type="button"
        aria-label="Close chart analysis"
        className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        onClick={onToggle}
      />
      <aside className="fixed inset-0 z-50 flex flex-col border-white/6 bg-zinc-950 lg:relative lg:inset-auto lg:z-auto lg:h-full lg:w-[min(360px,38vw)] lg:shrink-0 lg:border-l lg:bg-black/30">
      <div className="flex items-center justify-between gap-2 border-b border-white/6 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-cyan-400" />
          <div>
            <p className="text-xs font-bold text-white">Chart Analysis</p>
            <p className="text-[10px] text-zinc-500">
              {displayName} · {symbol}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="rounded-lg p-1.5 text-zinc-500 hover:text-cyan-400 disabled:opacity-40"
            title="Re-run analysis"
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
        {idle ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <Sparkles className="size-8 text-cyan-500/40" />
            <p className="text-xs text-zinc-500">
              Click <span className="text-cyan-400">Analyze chart</span> in the toolbar to run
              AI technical analysis on the current chart.
            </p>
          </div>
        ) : null}

        {loading && !analysis?.summary ? (
          <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
            <Loader2 className="size-4 animate-spin text-cyan-400" />
            Analyzing {displayName}…
          </div>
        ) : null}

        {error ? (
          <p className="mb-3 rounded-xl border border-rose-500/20 bg-rose-950/20 px-3 py-2 text-xs text-rose-300">
            {error}
          </p>
        ) : null}

        {genui ? (
          <div className="mb-4">
            <GenUiRenderer payload={genui} />
          </div>
        ) : null}

        {snapshotUrl ? (
          <div className="mb-4 overflow-hidden rounded-xl border border-white/8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={snapshotUrl}
              alt={`${symbol} chart snapshot`}
              className="w-full object-cover"
            />
          </div>
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
    </>
  );
}
