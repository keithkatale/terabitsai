"use client";

import * as React from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Activity, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { chartStyleCode, type ChartSpec, type TvInterval } from "@/lib/chart/tradingview-spec";

export type TradingViewChartProps = {
  symbol?: string;
  displayName?: string;
  interval?: TvInterval | string;
  indicators?: string[];
  range?: string;
  style?: ChartSpec["style"];
  theme?: ChartSpec["theme"];
  snapshotUrl?: string;
  analysisSummary?: string;
  /** Pre-computed analysis bias for badge */
  bias?: "bullish" | "bearish" | "neutral";
  confidence?: number;
  /** terminal = full-bleed chart for Markets tab */
  variant?: "card" | "terminal";
};

declare global {
  interface Window {
    TradingView?: {
      widget: new (config: Record<string, unknown>) => void;
    };
  }
}

const DEFAULT_STUDIES = [
  "RSI@tv-basicstudies",
  "MACD@tv-basicstudies",
  "Volume@tv-basicstudies",
] as const;

const CARD_DEFAULT_STUDIES = DEFAULT_STUDIES as unknown as string[];

const INTERVAL_LABELS: Record<string, string> = {
  "1": "1m",
  "5": "5m",
  "15": "15m",
  "30": "30m",
  "60": "1H",
  "240": "4H",
  D: "1D",
  W: "1W",
  M: "1M",
};

function BiasBadge({ bias }: { bias?: "bullish" | "bearish" | "neutral" }) {
  if (!bias) return null;
  const config = {
    bullish: { icon: TrendingUp, label: "Bullish", className: "text-emerald-400 bg-emerald-950/40 border-emerald-500/20" },
    bearish: { icon: TrendingDown, label: "Bearish", className: "text-rose-400 bg-rose-950/40 border-rose-500/20" },
    neutral: { icon: Minus, label: "Neutral", className: "text-zinc-400 bg-zinc-900/40 border-zinc-700/30" },
  }[bias];
  const Icon = config.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", config.className)}>
      <Icon className="size-3" />
      {config.label}
    </span>
  );
}

export function TradingViewChart({
  symbol = "NASDAQ:AAPL",
  displayName,
  interval = "D",
  indicators,
  range,
  style = "candles",
  theme = "dark",
  snapshotUrl,
  analysisSummary,
  bias,
  confidence,
  variant = "card",
}: TradingViewChartProps) {
  const resolvedIndicators =
    indicators ??
    (variant === "terminal" ? [] : CARD_DEFAULT_STUDIES);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useId().replace(/:/g, "");
  const lastInitKeyRef = useRef<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showSnapshot, setShowSnapshot] = useState(false);

  const label = displayName ?? symbol.split(":").pop() ?? symbol;
  const intervalLabel = INTERVAL_LABELS[String(interval)] ?? String(interval);
  const studiesKey = useMemo(() => resolvedIndicators.join("|"), [resolvedIndicators]);
  const initKey = `${symbol}|${interval}|${studiesKey}|${style}|${theme}|${variant}`;

  useEffect(() => {
    if (lastInitKeyRef.current === initKey) return;

    let cancelled = false;

    function loadScript(): Promise<void> {
      return new Promise((resolve, reject) => {
        if (window.TradingView?.widget) {
          resolve();
          return;
        }
        const existing = document.querySelector('script[src*="tradingview.com/tv.js"]');
        if (existing) {
          if (window.TradingView?.widget) {
            resolve();
          } else {
            existing.addEventListener("load", () => resolve());
            existing.addEventListener("error", () => reject(new Error("Failed to load TradingView")));
          }
          return;
        }
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/tv.js";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load TradingView"));
        document.head.appendChild(script);
      });
    }

    async function init() {
      try {
        await loadScript();
        if (cancelled || !containerRef.current || !window.TradingView?.widget) return;

        containerRef.current.innerHTML = `<div id="${widgetId}" class="h-full w-full"></div>`;

        const isTerminal = variant === "terminal";

        // eslint-disable-next-line new-cap
        new window.TradingView.widget({
          autosize: true,
          symbol,
          interval: String(interval),
          timezone: "Etc/UTC",
          theme,
          style: chartStyleCode(style),
          locale: "en",
          enable_publishing: false,
          allow_symbol_change: !isTerminal,
          studies: resolvedIndicators,
          container_id: widgetId,
          hide_side_toolbar: isTerminal,
          hide_top_toolbar: false,
          withdateranges: !isTerminal,
          details: false,
          hotlist: false,
          calendar: false,
        });

        if (!cancelled) {
          lastInitKeyRef.current = initKey;
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
    // initKey encodes symbol / interval / studies for each variant
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed re-init only when initKey changes
  }, [initKey]);

  return (
    <div
      className={cn(
        variant === "terminal"
          ? "flex h-full w-full flex-col overflow-hidden bg-zinc-950"
          : "my-2 w-full rounded-xl border border-zinc-900 bg-zinc-950/50 shadow-xl backdrop-blur-xl animate-fade-in text-left overflow-hidden",
      )}
    >
      {variant === "card" ? (
      <div className="border-b border-zinc-900/80 px-3 py-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Activity className="size-3.5 shrink-0 text-cyan-400" />
              <span className="truncate text-xs font-bold uppercase tracking-wider text-zinc-100">
                {label}
              </span>
              <span className="rounded border border-violet-500/20 bg-violet-950/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-400">
                TradingView · {intervalLabel}
              </span>
              {bias ? <BiasBadge bias={bias} /> : null}
              {confidence != null ? (
                <span className="text-[10px] text-zinc-500">{confidence}% conf.</span>
              ) : null}
            </div>
            {analysisSummary ? (
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{analysisSummary}</p>
            ) : null}
            {range ? (
              <p className="mt-0.5 text-[10px] text-zinc-600">Range: {range}</p>
            ) : null}
          </div>

          {snapshotUrl ? (
            <button
              type="button"
              onClick={() => setShowSnapshot((v) => !v)}
              className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-[10px] font-semibold text-zinc-400 transition hover:text-cyan-400"
            >
              {showSnapshot ? "Live chart" : "AI snapshot"}
            </button>
          ) : null}
        </div>
      </div>
      ) : null}

      <div
        className={cn(
          "relative w-full bg-zinc-950",
          variant === "terminal" ? "min-h-0 flex-1 [&_iframe]:h-full [&_iframe]:w-full" : "h-[360px]",
        )}
      >
        {showSnapshot && snapshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={snapshotUrl}
            alt={`${label} chart snapshot analyzed by AI`}
            className="h-full w-full object-cover object-top"
          />
        ) : loadError ? (
          <div className="flex h-full items-center justify-center p-4 text-xs text-rose-400">
            {loadError}
            {snapshotUrl ? (
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => setShowSnapshot(true)}
              >
                View AI snapshot
              </button>
            ) : null}
          </div>
        ) : (
          <div ref={containerRef} className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full" />
        )}
      </div>

      {variant === "card" ? (
      <div className="border-t border-zinc-900/60 px-3 py-1.5">
        <p className="text-[9px] text-zinc-600">
          Charts by{" "}
          <a
            href="https://www.tradingview.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-cyan-500"
          >
            TradingView
          </a>
          {resolvedIndicators.length ? ` · ${resolvedIndicators.map((i) => i.split("@")[0]).join(", ")}` : null}
        </p>
      </div>
      ) : null}
    </div>
  );
}
