"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { chartStyleCode, type ChartSpec, type TvInterval } from "@/lib/chart/tradingview-spec";

declare global {
  interface Window {
    __chartReady?: boolean;
    TradingView?: {
      widget: new (config: Record<string, unknown>) => void;
    };
  }
}

function ChartFrameInner() {
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const capture = searchParams.get("capture") === "1";

  useEffect(() => {
    window.__chartReady = false;

    const symbol = searchParams.get("symbol") ?? "NASDAQ:AAPL";
    const interval = (searchParams.get("interval") ?? "D") as TvInterval;
    const studiesRaw = searchParams.get("studies") ?? "RSI@tv-basicstudies,MACD@tv-basicstudies";
    const studies = studiesRaw.split(",").filter(Boolean);
    const theme = searchParams.get("theme") === "light" ? "light" : "dark";
    const style = searchParams.get("style") ?? "candles";

    const spec: ChartSpec = {
      symbol,
      interval,
      indicators: studies,
      style: style as ChartSpec["style"],
      theme: theme as ChartSpec["theme"],
    };

    let cancelled = false;

    function loadScript(): Promise<void> {
      return new Promise((resolve, reject) => {
        if (window.TradingView?.widget) {
          resolve();
          return;
        }
        const existing = document.querySelector('script[src*="tradingview.com/tv.js"]');
        if (existing) {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () => reject(new Error("Failed to load TradingView script")));
          return;
        }
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/tv.js";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load TradingView script"));
        document.head.appendChild(script);
      });
    }

    async function initWidget() {
      try {
        await loadScript();
        if (cancelled || !containerRef.current || !window.TradingView?.widget) return;

        // Keep inner container — TradingView requires container_id to exist
        containerRef.current.innerHTML =
          '<div id="tv-chart-container-inner" style="width:100%;height:100%"></div>';

        // eslint-disable-next-line new-cap
        new window.TradingView.widget({
          autosize: true,
          symbol,
          interval,
          timezone: "Etc/UTC",
          theme,
          style: chartStyleCode(spec.style),
          locale: "en",
          enable_publishing: false,
          hide_top_toolbar: capture,
          hide_legend: capture,
          hide_side_toolbar: capture,
          allow_symbol_change: !capture,
          studies,
          container_id: "tv-chart-container-inner",
          withdateranges: !capture,
          details: false,
          hotlist: false,
          calendar: false,
        });

        // TradingView doesn't expose a reliable ready callback on free widget;
        // wait for iframe/content to appear then signal ready
        const checkReady = () => {
          const inner = document.getElementById("tv-chart-container-inner");
          const iframe = inner?.querySelector("iframe");
          if (iframe) {
            window.__chartReady = true;
          } else if (!cancelled) {
            setTimeout(checkReady, 500);
          }
        };
        setTimeout(checkReady, 1500);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          window.__chartReady = true; // unblock headless timeout fallback
        }
      }
    }

    initWidget();
    return () => {
      cancelled = true;
    };
  }, [searchParams, capture]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-rose-400 text-sm">
        Chart load error: {error}
      </div>
    );
  }

  return (
    <div
      id="tv-chart-container"
      ref={containerRef}
      className="h-screen w-screen bg-zinc-950"
    >
      <div id="tv-chart-container-inner" className="h-full w-full" />
    </div>
  );
}

export default function ChartFramePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-500 text-sm">
          Loading chart…
        </div>
      }
    >
      <ChartFrameInner />
    </Suspense>
  );
}
