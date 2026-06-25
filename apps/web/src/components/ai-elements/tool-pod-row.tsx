"use client";

import { ChevronDown } from "lucide-react";
import type { ChatToolPod } from "@/lib/chat/stream-types";
import { ORCHESTRATOR_HIGHLIGHT, ORCHESTRATOR_STATUS_CLASS } from "@/components/ai-elements/agent-visual-constants";
import { ActivitySpinner } from "@/components/ai-elements/activity-spinner";

function formatToolPreview(value: unknown, maxChars: number): string {
  try {
    const s = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    if (s.length <= maxChars) return s;
    return `${s.slice(0, maxChars)}…`;
  } catch {
    return String(value);
  }
}

export function ToolPodRow({ pod, defaultOpen = false }: { pod: ChatToolPod; defaultOpen?: boolean }) {
  const label = pod.name.replace(/_/g, " ");
  const statusLabel =
    pod.status === "running" ? "Running" : pod.ok === false ? "Failed" : "Done";
  const hasBody =
    Boolean(pod.args && Object.keys(pod.args).length > 0) ||
    (pod.status === "done" && (pod.output != null || Boolean(pod.error)));

  return (
    <div className="text-[11px] text-zinc-500">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-tight text-zinc-400">
          {label}
        </span>
        <span
          className={
            pod.status === "running"
              ? ORCHESTRATOR_STATUS_CLASS
              : pod.ok === false
                ? "text-red-400"
                : "text-emerald-400/90"
          }
        >
          {pod.status === "running" ? (
            <span className="inline-flex items-center gap-1">
              <ActivitySpinner color={ORCHESTRATOR_HIGHLIGHT} sizeClassName="size-2.5" />
              {statusLabel}
            </span>
          ) : (
            statusLabel
          )}
        </span>
        {pod.durationMs != null && pod.status === "done" ? (
          <span className="text-[10px] text-zinc-600">{pod.durationMs}ms</span>
        ) : null}
      </div>
      {hasBody ? (
        <details className="group/tool mt-0.5" open={defaultOpen}>
          <summary className="cursor-pointer list-none py-0.5 text-[10px] text-zinc-500 marker:hidden hover:text-zinc-300 [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-0.5">
              <ChevronDown
                className="h-3 w-3 shrink-0 opacity-60 transition-transform group-open/tool:rotate-180"
                aria-hidden
              />
              Inputs &amp; result
            </span>
          </summary>
          <div className="mt-1 space-y-2">
            {pod.args && Object.keys(pod.args).length > 0 ? (
              <pre className="max-h-24 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-zinc-500">
                {formatToolPreview(pod.args, 2000)}
              </pre>
            ) : null}
            {pod.status === "done" ? (
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-zinc-500">
                {pod.error ? pod.error : formatToolPreview(pod.output ?? {}, 6000)}
              </pre>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
