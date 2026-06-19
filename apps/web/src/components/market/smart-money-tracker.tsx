"use client";

import { useEffect, useState } from "react";
import type { SynthesisBrief } from "@quant/contracts";
import { SynthesisCard } from "./synthesis-card";
import { TrendingUp } from "lucide-react";

export function SmartMoneyTracker({ onSymbolClick }: { onSymbolClick?: (s: string) => void }) {
  const [briefs, setBriefs] = useState<SynthesisBrief[]>([]);

  useEffect(() => {
    fetch("/api/intel/briefs?type=flow&limit=10")
      .then((r) => r.json())
      .then((d) => setBriefs(d.briefs ?? []))
      .catch(() => {});
  }, []);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <TrendingUp className="size-4 text-indigo-400" />
        <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Smart Money Tracker</h3>
      </div>
      {briefs.length === 0 ? (
        <p className="text-[10px] text-zinc-600 px-1">No flow events yet. Configure FMP_API_KEY for insider data.</p>
      ) : (
        briefs.map((b) => <SynthesisCard key={b.id} brief={b} onSymbolClick={onSymbolClick} />)
      )}
    </section>
  );
}
