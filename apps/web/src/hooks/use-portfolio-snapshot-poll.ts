"use client";

import { useCallback, useEffect, useRef } from "react";
import type { TradingMode } from "@/lib/account/api";
import { PORTFOLIO_UPDATED_EVENT } from "@/lib/portfolio/portfolio-events";

const ACTIVE_POLL_MS = 10 * 60 * 1000;

async function requestPortfolioSnapshot(
  mode: TradingMode,
  reason: "periodic" | "trade" | "deposit" | "withdrawal" | "close" | "manual",
  force = false,
) {
  await fetch("/api/portfolio/snapshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ mode, reason, force }),
  });
}

/**
 * While the personal area is visible, capture wealth snapshots every 10 minutes
 * (Benchmark uses ~10m cron; trades/deposits force immediate snapshots).
 */
export function usePortfolioSnapshotPoll(mode: TradingMode, enabled: boolean) {
  const busyRef = useRef(false);

  const capture = useCallback(
    async (
      reason: "periodic" | "trade" | "deposit" | "withdrawal" | "close" | "manual",
      force = false,
    ) => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        await requestPortfolioSnapshot(mode, reason, force);
      } catch {
        /* non-blocking */
      } finally {
        busyRef.current = false;
      }
    },
    [mode],
  );

  useEffect(() => {
    if (!enabled) return;

    void capture("periodic", false);

    const interval = window.setInterval(() => {
      void capture("periodic", false);
    }, ACTIVE_POLL_MS);

    const onPortfolioUpdated = () => {
      void capture("trade", true);
    };

    window.addEventListener(PORTFOLIO_UPDATED_EVENT, onPortfolioUpdated);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(PORTFOLIO_UPDATED_EVENT, onPortfolioUpdated);
    };
  }, [enabled, capture]);
}

export { requestPortfolioSnapshot };
