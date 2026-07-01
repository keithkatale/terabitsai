"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ChartDrawing } from "@/lib/chart/chart-drawings";

type ChartDrawingsContextValue = {
  symbol: string | null;
  drawings: ChartDrawing[];
  overlayVisible: boolean;
  setOverlayVisible: (visible: boolean) => void;
  applyDrawings: (
    symbol: string,
    drawings: ChartDrawing[],
    options?: { clearPrevious?: boolean },
  ) => void;
  clearDrawings: (symbol?: string) => void;
  setActiveSymbol: (symbol: string | null) => void;
};

const ChartDrawingsContext = createContext<ChartDrawingsContextValue | null>(null);

export function ChartDrawingsProvider({ children }: { children: ReactNode }) {
  const [symbol, setSymbol] = useState<string | null>(null);
  const [drawings, setDrawings] = useState<ChartDrawing[]>([]);
  const [overlayVisible, setOverlayVisible] = useState(true);

  const setActiveSymbol = useCallback((next: string | null) => {
    setSymbol(next);
    setDrawings([]);
  }, []);

  const applyDrawings = useCallback(
    (targetSymbol: string, next: ChartDrawing[], options?: { clearPrevious?: boolean }) => {
      setSymbol(targetSymbol);
      setDrawings((prev) => {
        if (options?.clearPrevious) return next;
        const merged = [...prev];
        for (const d of next) merged.push(d);
        return merged;
      });
    },
    [],
  );

  const clearDrawings = useCallback((targetSymbol?: string) => {
    if (targetSymbol && symbol && targetSymbol.toUpperCase() !== symbol.toUpperCase()) return;
    setDrawings([]);
  }, [symbol]);

  const value = useMemo(
    () => ({
      symbol,
      drawings,
      overlayVisible,
      setOverlayVisible,
      applyDrawings,
      clearDrawings,
      setActiveSymbol,
    }),
    [symbol, drawings, overlayVisible, applyDrawings, clearDrawings, setActiveSymbol],
  );

  return (
    <ChartDrawingsContext.Provider value={value}>{children}</ChartDrawingsContext.Provider>
  );
}

export function useChartDrawings() {
  const ctx = useContext(ChartDrawingsContext);
  if (!ctx) {
    throw new Error("useChartDrawings must be used within ChartDrawingsProvider");
  }
  return ctx;
}
