"use client";

import { useEffect, useRef, useState } from "react";
import type { CopilotGreetingResult } from "@/lib/home/copilot-greeting";

export function useCopilotGreeting(focusSymbol: string) {
  const symbol = focusSymbol.trim();
  const [data, setData] = useState<CopilotGreetingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [animationKey, setAnimationKey] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!symbol) return;

    const requestId = ++requestIdRef.current;
    setLoading(true);

    const controller = new AbortController();

    void (async () => {
      try {
        const res = await fetch(
          `/api/home/copilot-greeting?symbol=${encodeURIComponent(symbol)}`,
          { signal: controller.signal, credentials: "include" },
        );
        if (!res.ok) throw new Error("Failed to load greeting");
        const json = (await res.json()) as CopilotGreetingResult;
        if (requestId !== requestIdRef.current) return;
        setData(json);
        setAnimationKey((k) => k + 1);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (requestId !== requestIdRef.current) return;
        setData(null);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [symbol]);

  return { data, loading, animationKey, symbol };
}
