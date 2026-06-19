"use client";

import { useEffect, useState } from "react";
import { Network } from "lucide-react";

export function RippleGraph({ symbol }: { symbol: string }) {
  const [nodes, setNodes] = useState<Array<{ id: string; label: string; symbol?: string | null; type: string }>>([]);
  const [edges, setEdges] = useState<Array<{ fromId: string; toId: string; relation: string }>>([]);

  useEffect(() => {
    fetch(`/api/intel/ripple?symbol=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((d) => {
        setNodes(d.nodes ?? []);
        setEdges(d.edges ?? []);
      })
      .catch(() => {});
  }, [symbol]);

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <section className="rounded-xl border border-zinc-900/60 bg-zinc-950/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Network className="size-4 text-indigo-400" />
        <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Ripple Effect — {symbol}</h3>
      </div>
      {edges.length === 0 ? (
        <p className="text-[10px] text-zinc-600">Building entity graph…</p>
      ) : (
        <ul className="space-y-1.5 text-[10px]">
          {edges.slice(0, 12).map((e, i) => {
            const from = nodeMap.get(e.fromId);
            const to = nodeMap.get(e.toId);
            return (
              <li key={i} className="text-zinc-400 flex items-center gap-1 flex-wrap">
                <span className="font-mono text-indigo-300">{from?.symbol ?? from?.label}</span>
                <span className="text-zinc-600">→ {e.relation} →</span>
                <span className="font-mono text-zinc-300">{to?.symbol ?? to?.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
