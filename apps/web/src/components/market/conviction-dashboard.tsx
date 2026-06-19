"use client";

import { useEffect, useState } from "react";
import type { ConvictionDashboard } from "@quant/contracts";
import { cn } from "@/lib/utils";

export function ConvictionDashboardStrip({ symbols }: { symbols?: string[] }) {
  const [items, setItems] = useState<ConvictionDashboard[]>([]);

  useEffect(() => {
    const params = symbols?.length ? `?symbols=${symbols.join(",")}` : "";
    fetch(`/api/intel/conviction${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.items) setItems(d.items.slice(0, 6));
      })
      .catch(() => {});
  }, [symbols]);

  if (items.length === 0) return null;

  return (
    <div className="shrink-0 border-b border-zinc-900/60 px-3 py-2.5 overflow-x-auto bg-zinc-950/30">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Conviction</p>
      <div className="flex gap-3">
        {items.map((item) => (
          <div key={item.symbol} className="shrink-0 min-w-[80px] terminal-card px-2.5 py-2">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold text-zinc-200 tracking-tight">{item.symbol}</span>
              <span
                className={cn(
                  "text-xs font-bold terminal-num",
                  item.score >= 60 ? "text-emerald-400" : item.score >= 35 ? "text-amber-400" : "text-zinc-500"
                )}
              >
                {item.score}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-800 mt-1.5 overflow-hidden">
              <div className="h-full bg-indigo-400 rounded-full transition-all" style={{ width: `${item.score}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
