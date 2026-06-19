"use client";

import type { SynthesisBrief } from "@quant/contracts";
import { cn } from "@/lib/utils";

export function ProvenanceChips({ provenance }: { provenance: SynthesisBrief["provenance"] }) {
  if (!provenance?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {provenance.map((p, i) => (
        <span
          key={i}
          className="terminal-badge bg-zinc-900/80 border border-zinc-700/50 text-zinc-400 font-medium normal-case"
        >
          {p.url ? (
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-300">
              {p.source}
            </a>
          ) : (
            p.source
          )}
        </span>
      ))}
    </div>
  );
}

export function SynthesisCard({
  brief,
  onSymbolClick,
  stale,
}: {
  brief: SynthesisBrief;
  onSymbolClick?: (symbol: string) => void;
  stale?: boolean;
}) {
  return (
    <article
      className={cn(
        "terminal-card-raised p-4 space-y-2.5",
        stale && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-white leading-snug">{brief.headline}</h3>
        <span className="terminal-badge bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 shrink-0">
          {brief.impactScore}/10
        </span>
      </div>
      <p className="text-sm text-zinc-400 leading-relaxed">{brief.thesis}</p>
      {brief.bullets.bullish?.length ? (
        <ul className="text-xs text-emerald-400/95 space-y-1">
          {brief.bullets.bullish.map((b, i) => (
            <li key={i}>+ {b}</li>
          ))}
        </ul>
      ) : null}
      {brief.bullets.bearish?.length ? (
        <ul className="text-xs text-red-400/95 space-y-1">
          {brief.bullets.bearish.map((b, i) => (
            <li key={i}>− {b}</li>
          ))}
        </ul>
      ) : null}
      <ProvenanceChips provenance={brief.provenance} />
      <div className="flex flex-wrap gap-1.5 pt-1">
        {brief.symbols.map((sym) => (
          <button
            key={sym}
            type="button"
            onClick={() => onSymbolClick?.(sym)}
            className="terminal-btn terminal-btn-ghost py-1 px-2 text-[11px] text-indigo-300"
          >
            {sym}
          </button>
        ))}
      </div>
    </article>
  );
}
