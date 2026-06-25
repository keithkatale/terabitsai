"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChartAnalysis } from "@/lib/chart/tradingview-spec";
import type { TvInterval } from "@/lib/chart/tradingview-spec";

export type AnalysisStreamState = {
  status: "idle" | "loading" | "streaming" | "done" | "error";
  analysis: Partial<ChartAnalysis> | null;
  reasoningText: string;
  error: string | null;
  snapshotUrl: string | null;
  genui: unknown | null;
};

const analysisCache = new Map<
  string,
  { analysis: ChartAnalysis; snapshotUrl?: string; genui?: unknown }
>();

function cacheKey(symbol: string, interval: string, indicators: string[]) {
  return `${symbol}:${interval}:${[...indicators].sort().join(",")}`;
}

export function useChartAnalysis(params: {
  symbol: string;
  interval: TvInterval;
  indicators: string[];
  /** When true, auto-run on symbol/interval change. Default false — use refresh() for one-click analyze. */
  autoRun?: boolean;
}) {
  const { symbol, interval, indicators, autoRun = false } = params;
  const [state, setState] = useState<AnalysisStreamState>({
    status: "idle",
    analysis: null,
    reasoningText: "",
    error: null,
    snapshotUrl: null,
    genui: null,
  });
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runAnalysis = useCallback(async (opts?: { bypassCache?: boolean }) => {
    if (!symbol) return;

    const key = cacheKey(symbol, interval, indicators);
    const cached = !opts?.bypassCache ? analysisCache.get(key) : undefined;
    if (cached) {
      setState({
        status: "done",
        analysis: cached.analysis,
        reasoningText: cached.analysis.reasoning ?? "",
        error: null,
        snapshotUrl: cached.snapshotUrl ?? null,
        genui: cached.genui ?? null,
      });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({
      status: "loading",
      analysis: null,
      reasoningText: "",
      error: null,
      snapshotUrl: null,
      genui: null,
    });

    try {
      const res = await fetch("/api/markets/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({ symbol, interval, indicators }),
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error ?? `Analysis failed (${res.status})`);
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const json = (await res.json()) as {
          analysis: ChartAnalysis;
          snapshot_url?: string;
        };
        analysisCache.set(key, {
          analysis: json.analysis,
          snapshotUrl: json.snapshot_url,
          genui: (json as { genui?: unknown }).genui,
        });
        setState({
          status: "done",
          analysis: json.analysis,
          reasoningText: json.analysis.reasoning ?? "",
          error: null,
          snapshotUrl: json.snapshot_url ?? null,
          genui: (json as { genui?: unknown }).genui ?? null,
        });
        return;
      }

      if (!res.body) throw new Error("No response stream");

      setState((s) => ({ ...s, status: "streaming" }));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let reasoningText = "";
      let finalAnalysis: ChartAnalysis | null = null;
      let snapshotUrl: string | null = null;
      let genuiPayload: unknown | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const event = JSON.parse(payload) as {
              type: string;
              text?: string;
              analysis?: ChartAnalysis;
              snapshot_url?: string;
              payload?: unknown;
              error?: string;
            };
            if (event.type === "reasoning" && event.text) {
              reasoningText += event.text;
              setState((s) => ({
                ...s,
                status: "streaming",
                reasoningText,
              }));
            } else if (event.type === "genui" && event.payload) {
              genuiPayload = event.payload;
              setState((s) => ({ ...s, genui: event.payload ?? null }));
            } else if (event.type === "analysis" && event.analysis) {
              finalAnalysis = event.analysis;
              snapshotUrl = event.snapshot_url ?? snapshotUrl;
              setState((s) => ({
                ...s,
                status: "streaming",
                analysis: event.analysis ?? null,
                reasoningText: event.analysis?.reasoning ?? reasoningText,
                snapshotUrl,
              }));
            } else if (event.type === "error") {
              throw new Error(event.error ?? "Stream error");
            } else if (event.type === "done" && event.analysis) {
              finalAnalysis = event.analysis;
              snapshotUrl = event.snapshot_url ?? snapshotUrl;
            }
          } catch {
            /* skip malformed SSE chunks */
          }
        }
      }

      if (finalAnalysis) {
        analysisCache.set(key, {
          analysis: finalAnalysis,
          snapshotUrl: snapshotUrl ?? undefined,
          genui: genuiPayload ?? undefined,
        });
        setState({
          status: "done",
          analysis: finalAnalysis,
          reasoningText: finalAnalysis.reasoning ?? reasoningText,
          error: null,
          snapshotUrl,
          genui: genuiPayload,
        });
      } else {
        setState((s) => ({
          ...s,
          status: reasoningText ? "done" : "error",
          error: reasoningText ? null : "No analysis returned",
        }));
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState({
        status: "error",
        analysis: null,
        reasoningText: "",
        error: err instanceof Error ? err.message : "Analysis failed",
        snapshotUrl: null,
        genui: null,
      });
    }
  }, [symbol, interval, indicators]);

  useEffect(() => {
    if (autoRun) return;
    setState({
      status: "idle",
      analysis: null,
      reasoningText: "",
      error: null,
      snapshotUrl: null,
      genui: null,
    });
    abortRef.current?.abort();
  }, [symbol, interval, indicators.join(","), autoRun]);

  useEffect(() => {
    if (!autoRun || !symbol) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runAnalysis();
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [symbol, interval, indicators.join(","), autoRun, runAnalysis]);

  return {
    ...state,
    refresh: () => runAnalysis({ bypassCache: true }),
    runAnalysis,
  };
}
