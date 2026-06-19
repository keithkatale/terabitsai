"use client";

import { useEffect, useState } from "react";
import { Newspaper } from "lucide-react";
import type { IntelDocument, SynthesisBrief } from "@quant/contracts";
import { SynthesisCard } from "@/components/market/synthesis-card";
import { EventHorizon } from "@/components/market/event-horizon";
import { EarningsInterrogator } from "@/components/market/earnings-interrogator";
import { cn } from "@/lib/utils";

export function NewsTab({ activeSymbol }: { activeSymbol: string }) {
  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState<SynthesisBrief | null>(null);
  const [documents, setDocuments] = useState<IntelDocument[]>([]);
  const [legacyNarrative, setLegacyNarrative] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetch(`/api/intel/briefs?type=catalyst&symbol=${encodeURIComponent(activeSymbol)}&limit=1`).then((r) => r.json()),
      fetch(`/api/intel/documents?symbol=${encodeURIComponent(activeSymbol)}&limit=15`).then((r) => r.json()),
      fetch(`/api/market/news-feed?symbol=${encodeURIComponent(activeSymbol)}`).then((r) => r.json())
    ])
      .then(([briefsRes, docsRes, legacyRes]) => {
        if (cancelled) return;
        setBrief(briefsRes.briefs?.[0] ?? null);
        if (docsRes.documents?.length) {
          setDocuments(docsRes.documents);
        } else if (legacyRes?.feed) {
          setLegacyNarrative(legacyRes.feed.narrative ?? "");
          setDocuments(
            (legacyRes.feed.news ?? []).map((n: { title: string; summary: string; source: string; sentiment: string }, i: number) => ({
              id: `legacy-${i}`,
              diet: "catalyst" as const,
              source: n.source,
              symbols: [activeSymbol],
              title: n.title,
              body: n.summary,
              url: null,
              sentiment: n.sentiment === "bullish" ? 0.5 : n.sentiment === "bearish" ? -0.5 : 0,
              createdAt: new Date().toISOString()
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSymbol]);

  return (
    <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Newspaper className="size-4 text-indigo-400" />
        <h2 className="text-sm font-extrabold text-white">Market News — {activeSymbol}</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <EventHorizon symbol={activeSymbol} />
        <EarningsInterrogator symbol={activeSymbol} />
      </div>

      {loading ? (
        <p className="text-xs text-zinc-600 px-1">Loading intelligence…</p>
      ) : (
        <>
          {brief ? (
            <SynthesisCard brief={brief} />
          ) : legacyNarrative ? (
            <p className="text-sm text-zinc-300 leading-relaxed border border-zinc-900/60 rounded-xl p-4 bg-zinc-950/40">{legacyNarrative}</p>
          ) : (
            <p className="text-xs text-zinc-600">Insufficient verified data — run intel worker to ingest headlines.</p>
          )}

          <div className="space-y-3">
            <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">Verified sources</h3>
            {documents.map((item) => (
              <article key={item.id} className="rounded-xl border border-zinc-900/60 bg-zinc-950/40 p-4">
                <div className="flex justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-300">
                        {item.title}
                      </a>
                    ) : (
                      item.title
                    )}
                  </h3>
                  <span
                    className={cn(
                      "text-[9px] font-bold uppercase shrink-0",
                      (item.sentiment ?? 0) > 0.1 ? "text-emerald-400" : (item.sentiment ?? 0) < -0.1 ? "text-red-400" : "text-zinc-500"
                    )}
                  >
                    {item.source}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-2">{item.body}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
