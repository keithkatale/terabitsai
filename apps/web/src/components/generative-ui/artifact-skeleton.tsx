"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";

/**
 * Shown in place of an artifact / generative-UI block while it is still
 * streaming (the fenced code block has not closed yet). Prevents the broken,
 * flickering partial-iframe render the old pipeline produced mid-stream.
 */
export function ArtifactSkeleton({ kind = "interface" }: { kind?: "interface" | "artifact" }) {
  const label = kind === "artifact" ? "Building interactive artifact" : "Composing interface";
  return (
    <div className="my-3 w-full overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-950/40 animate-fade-in">
      <div className="flex items-center justify-between border-b border-zinc-900/60 bg-zinc-950/70 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-cyan-400" />
          <span className="text-xs font-semibold text-zinc-300">{label}</span>
        </div>
        <Loader2 className="size-3.5 animate-spin text-zinc-500" />
      </div>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl genui-skeleton-shimmer" />
          ))}
        </div>
        <div className="h-28 rounded-xl genui-skeleton-shimmer" />
        <div className="h-3 w-2/3 rounded genui-skeleton-shimmer" />
      </div>
    </div>
  );
}
