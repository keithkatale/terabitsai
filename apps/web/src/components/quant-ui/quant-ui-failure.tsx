"use client";

import * as React from "react";
import { TriangleAlert } from "lucide-react";

/** User-facing failure when Quant UI cannot render — never shows raw markup to the user. */
export function QuantUiFailure({
  title = "Could not display this interface",
  reason,
}: {
  title?: string;
  reason?: string;
}) {
  return (
    <div className="quant-ui my-2 w-full rounded-2xl border border-rose-500/25 bg-rose-950/15 p-4 text-left">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-rose-500/10 p-2">
          <TriangleAlert className="size-4 text-rose-400" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-rose-200">{title}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">
            {reason ?? "The assistant returned an interface we couldn't render. Try asking again or request a simpler view."}
          </p>
        </div>
      </div>
    </div>
  );
}
