"use client";

import { useEffect, useState } from "react";
import type { SynthesisBrief } from "@quant/contracts";
import { SynthesisCard } from "./synthesis-card";
import { FileText } from "lucide-react";

export function EarningsInterrogator({
  symbol,
  onSymbolClick,
}: {
  symbol: string;
  onSymbolClick?: (s: string) => void;
}) {
  const [brief, setBrief] = useState<SynthesisBrief | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/intel/briefs?type=fundamental&symbol=${encodeURIComponent(symbol)}&limit=1`)
      .then((r) => r.json())
      .then((d) => setBrief(d.briefs?.[0] ?? null))
      .catch(() => setBrief(null))
      .finally(() => setLoading(false));
  }, [symbol]);

  return (
    <section className="rounded-xl border border-zinc-900/60 bg-zinc-950/40 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <FileText className="size-4 text-indigo-400" />
        <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Earnings Interrogator</h3>
      </div>
      {loading ? (
        <p className="text-[10px] text-zinc-600">Loading transcript analysis…</p>
      ) : brief ? (
        <SynthesisCard brief={brief} onSymbolClick={onSymbolClick} />
      ) : (
        <p className="text-[10px] text-zinc-600">
          No FMP transcript analysis yet. Set FMP_API_KEY and run intel worker cold scan.
        </p>
      )}
    </section>
  );
}
