"use client";

import * as React from "react";
import { TriangleAlert, RefreshCw, ChevronDown, Copy, Check } from "lucide-react";
import { useChatWidgetAction } from "@/contexts/chat-widget-context";
import { cn } from "@/lib/utils";

/** User-facing failure when Quant UI cannot render — with retry capability. */
export function QuantUiFailure({
  title = "Could not display this interface",
  reason,
  errorDetails,
  rawPayload,
  onRetry,
}: {
  title?: string;
  reason?: string;
  /** Technical error details for debugging */
  errorDetails?: string;
  /** The raw payload that failed to parse/render */
  rawPayload?: string;
  /** Custom retry handler */
  onRetry?: (instruction: string) => void;
}) {
  const [showDebug, setShowDebug] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const fireAction = useChatWidgetAction();

  const handleRetry = () => {
    const instruction = `The previous visual interface failed to render. ${errorDetails ? `Error: ${errorDetails}. ` : ""}Please regenerate a simpler, valid genui layout. Use basic components like metricCard, stat, keyValue, or text nodes. Avoid complex nested structures.`;
    
    if (onRetry) {
      onRetry(instruction);
    } else if (fireAction) {
      fireAction({ type: "prompt", prompt: instruction });
    }
  };

  const handleCopyDebug = async () => {
    const debug = [
      "=== GenUI Render Failure ===",
      `Title: ${title}`,
      `Reason: ${reason ?? "Unknown"}`,
      errorDetails ? `Error: ${errorDetails}` : null,
      rawPayload ? `\nRaw Payload:\n${rawPayload}` : null,
    ].filter(Boolean).join("\n");

    try {
      await navigator.clipboard.writeText(debug);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("Failed to copy debug info");
    }
  };

  return (
    <div className="quant-ui my-2 w-full rounded-2xl border border-rose-500/25 bg-rose-950/15 p-4 text-left">
      <div className="flex items-start gap-3">
        <span className="shrink-0 rounded-lg bg-rose-500/10 p-2">
          <TriangleAlert className="size-4 text-rose-400" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-rose-200">{title}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">
            {reason ?? "The assistant returned an interface we couldn't render."}
          </p>
          
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20"
            >
              <RefreshCw className="size-3" />
              Try again with simpler view
            </button>

            {(errorDetails || rawPayload) && (
              <button
                type="button"
                onClick={() => setShowDebug(!showDebug)}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-2.5 py-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
              >
                <ChevronDown className={cn("size-3 transition-transform", showDebug && "rotate-180")} />
                Debug info
              </button>
            )}
          </div>

          {showDebug && (errorDetails || rawPayload) && (
            <div className="mt-3 rounded-lg border border-zinc-800/60 bg-zinc-950/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">Technical Details</span>
                <button
                  type="button"
                  onClick={handleCopyDebug}
                  className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300"
                >
                  {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              {errorDetails && (
                <p className="mb-2 text-[11px] text-rose-400/80">{errorDetails}</p>
              )}
              {rawPayload && (
                <pre className="max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-zinc-500">
                  {rawPayload.slice(0, 500)}{rawPayload.length > 500 ? "..." : ""}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
