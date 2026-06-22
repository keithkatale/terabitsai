"use client";

import * as React from "react";
import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ChevronDown, Loader2 } from "lucide-react";
import { AssistantSiriOrb } from "./assistant-siri-orb";
import { MarkdownContent } from "./markdown-content";
import { GenUiRenderer } from "@/components/generative-ui/genui-renderer";
import { QuantUiRenderer } from "@/components/quant-ui/quant-ui-renderer";
import { stripGenuiFences } from "@/lib/genui/strip-genui-fences";
import { stripInjectedArtifactMarkdown } from "@/lib/genui/strip-artifact-fences";
import { stripInteractiveQuestionMarkup } from "@/lib/chat/interactive-question-helper";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
import type { ChatToolPod } from "@/lib/chat/stream-types";

export interface MessagePart {
  type: "reasoning" | "text" | "trade-execution" | "genui" | "quant-ui" | "monitor_directive" | "session_divider";
  text?: string;
  payload?: unknown;
}

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant" | "system";
  parts: MessagePart[];
  toolPods?: ChatToolPod[];
  liveStatus?: string;
  liveStatusDetail?: string;
}

export interface TradeData {
  id: string;
  symbol: string;
  direction: "BUY" | "SELL";
  entryPrice: number;
  closePrice?: number;
  size: number;
  leverage: number;
  margin: number;
  tp: number | null;
  sl: number | null;
  pnl?: number;
  status: "OPEN" | "CLOSED";
  timestamp: number;
}

function formatToolPreview(value: unknown, maxChars: number): string {
  try {
    const s = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    if (s.length <= maxChars) return s;
    return `${s.slice(0, maxChars)}…`;
  } catch {
    return String(value);
  }
}

function ToolPodRow({ pod, defaultOpen = false }: { pod: ChatToolPod; defaultOpen?: boolean }) {
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
              ? "text-[#24ee89]"
              : pod.ok === false
                ? "text-red-400"
                : "text-emerald-400/90"
          }
        >
          {pod.status === "running" ? (
            <span className="inline-flex items-center gap-1">
              <span className="inline-block size-1 animate-pulse rounded-full bg-[#24ee89]" aria-hidden />
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

function TypingDots() {
  return (
    <span className="inline-flex shrink-0 items-end gap-[3px]" aria-hidden>
      <span className="inline-block size-[5px] animate-bounce rounded-full bg-[#24ee89] [animation-duration:0.6s]" />
      <span className="inline-block size-[5px] animate-bounce rounded-full bg-[#24ee89] [animation-duration:0.6s] [animation-delay:0.12s]" />
      <span className="inline-block size-[5px] animate-bounce rounded-full bg-[#24ee89] [animation-duration:0.6s] [animation-delay:0.24s]" />
    </span>
  );
}

function AgentActivity({
  reasoning,
  toolPods,
  isAssistantStreaming,
  liveStatus,
  liveStatusDetail,
}: {
  reasoning: string;
  toolPods: ChatToolPod[];
  isAssistantStreaming: boolean;
  liveStatus?: string;
  liveStatusDetail?: string;
}) {
  const r = reasoning.trim();
  const runningPod = [...toolPods].reverse().find((p) => p.status === "running");

  if (isAssistantStreaming) {
    const label = liveStatus ?? (runningPod ? runningPod.name.replace(/_/g, " ") : "Thinking");
    const hasDetail = Boolean(runningPod || toolPods.length > 0 || r.length > 0 || liveStatusDetail);

    return (
      <details key="active" open className="group/act w-full max-w-full mb-2" role="status" aria-live="polite">
        <summary className="flex cursor-pointer list-none select-none items-center gap-2 py-1 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[12.5px] font-medium text-shimmer text-[#24ee89]">
              {label}
              {liveStatusDetail ? (
                <span className="ml-1.5 font-normal text-zinc-400">· {liveStatusDetail}</span>
              ) : null}
            </span>
            <TypingDots />
            {hasDetail ? (
              <ChevronDown className="size-3.5 shrink-0 text-[#24ee89] transition-transform group-open/act:rotate-180 ml-1" aria-hidden />
            ) : null}
          </span>
        </summary>
        {hasDetail ? (
          <div className="ml-0.5 mt-1 space-y-2 border-l border-white/[0.08] pl-3">
            {toolPods.length > 0 ? (
              <div className="space-y-1.5">
                {toolPods.map((pod) => (
                  <ToolPodRow
                    key={pod.toolUseId}
                    pod={pod}
                    defaultOpen={runningPod ? pod.toolUseId === runningPod.toolUseId : false}
                  />
                ))}
              </div>
            ) : null}
            {r.length > 0 ? (
              <details open className="group/cot">
                <summary className="cursor-pointer list-none py-0.5 text-[10px] text-zinc-500 marker:hidden hover:text-zinc-300 [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-0.5">
                    <ChevronDown className="h-3 w-3 shrink-0 opacity-60 transition-transform group-open/cot:rotate-180" aria-hidden />
                    Chain of thought
                  </span>
                </summary>
                <pre className="mt-1 max-h-36 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-zinc-500">
                  {r}
                </pre>
              </details>
            ) : null}
          </div>
        ) : null}
      </details>
    );
  }

  if (r.length === 0 && toolPods.length === 0) return null;

  return (
    <details key="done" className="group/trace mb-2 w-full max-w-full">
      <summary className="cursor-pointer list-none select-none py-1 text-[11px] font-medium text-zinc-500 marker:hidden transition-colors hover:text-zinc-300 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1.5">
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-55 transition-transform group-open/trace:rotate-180" aria-hidden />
          How this reply was built
        </span>
      </summary>
      <div className="ml-0.5 mt-1 space-y-2 border-l border-white/[0.08] pl-3">
        {toolPods.length > 0 ? (
          <div className="space-y-1.5">
            {toolPods.map((pod) => (
              <ToolPodRow key={pod.toolUseId} pod={pod} />
            ))}
          </div>
        ) : null}
        {r.length > 0 ? (
          <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-zinc-500">
            {r}
          </pre>
        ) : null}
      </div>
    </details>
  );
}

export const TradeReceiptCard = ({
  trade,
  currentPrice,
  onClosePosition,
}: {
  trade: TradeData;
  currentPrice?: number;
  onClosePosition?: (id: string) => void;
}) => {
  const isClosed = trade.status === "CLOSED";
  const pnl = isClosed
    ? trade.pnl || 0
    : currentPrice
      ? trade.direction === "BUY"
        ? (currentPrice - trade.entryPrice) * trade.size
        : (trade.entryPrice - currentPrice) * trade.size
      : 0;
  const isProfitable = pnl >= 0;

  return (
    <div
      className={cn(
        "w-full max-w-sm rounded-lg border p-3 flex flex-col gap-2.5 bg-zinc-950/60 backdrop-blur-sm mt-1",
        trade.direction === "BUY" ? "border-emerald-500/20" : "border-red-500/20"
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide",
            trade.direction === "BUY" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
          )}
        >
          {trade.direction}
        </span>
        <span className="text-[10px] text-zinc-600 font-mono">{trade.id}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AssetLogoIcon symbol={trade.symbol} size="sm" className="rounded-md" />
          <div>
            <h4 className="text-sm font-bold text-white leading-none">{trade.symbol}</h4>
            <p className="text-[10px] text-zinc-500 mt-0.5">{trade.leverage}x</p>
          </div>
        </div>
        <span className={cn("text-xs font-bold", isClosed ? "text-zinc-500" : "text-emerald-400")}>
          {trade.status}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono border-y border-zinc-900/60 py-2">
        <div className="flex justify-between">
          <span className="text-zinc-500">Entry</span>
          <span className="text-zinc-200">${trade.entryPrice.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Size</span>
          <span className="text-zinc-200">{trade.size}</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className={cn("text-sm font-mono font-bold", isProfitable ? "text-emerald-400" : "text-red-400")}>
          {isProfitable ? "+" : ""}${pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
        {!isClosed && onClosePosition ? (
          <button
            onClick={() => onClosePosition(trade.id)}
            className="px-2 py-1 rounded text-[10px] font-semibold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 cursor-pointer"
          >
            Close
          </button>
        ) : null}
      </div>
    </div>
  );
};

export function ChatMessage({
  message,
  isAssistantStreaming = false,
  hideAssistantOrb = false,
  livePrices,
  onClosePosition,
  guestSignInCta = false,
  rootRef,
}: {
  message: ChatMessageData;
  isAssistantStreaming?: boolean;
  hideAssistantOrb?: boolean;
  livePrices?: Record<string, { spot: number }>;
  onClosePosition?: (id: string) => void;
  guestSignInCta?: boolean;
  rootRef?: React.Ref<HTMLDivElement | null>;
}) {
  const sessionDivider = message.parts.find((p) => p.type === "session_divider");
  if (sessionDivider?.text) {
    const sessionNum = (sessionDivider.payload as { sessionNumber?: number })?.sessionNumber;
    return (
      <div ref={rootRef} className="my-6 w-full animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-cyan-400/80">
            {sessionNum ? `Session ${sessionNum} saved` : "Session saved"}
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
        </div>
        <p className="mx-auto mt-2 max-w-md text-center text-[11px] leading-relaxed text-zinc-500">
          {sessionDivider.text.slice(0, 280)}
          {sessionDivider.text.length > 280 ? "…" : ""}
        </p>
      </div>
    );
  }

  if (message.role === "user") {
    const monitorPart = message.parts.find((p) => p.type === "monitor_directive");
    const userText = monitorPart?.text
      ? monitorPart.text
      : message.parts
          .filter((p) => p.type === "text")
          .map((p) => p.text ?? "")
          .join("");

    if (monitorPart) {
      return (
        <div ref={rootRef} className="flex justify-end w-full animate-fade-in">
          <div className="max-w-[85%] sm:max-w-[640px] rounded-xl border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-2.5 text-sm leading-relaxed text-zinc-100">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
              Wealth Monitor → Command
            </p>
            <div className="whitespace-pre-wrap">{userText}</div>
          </div>
        </div>
      );
    }

    return (
      <div ref={rootRef} className="flex justify-end w-full animate-fade-in">
        <div className="max-w-[85%] sm:max-w-[640px] whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-900/60 px-3.5 py-2.5 text-sm leading-relaxed text-zinc-200">
          {userText}
        </div>
      </div>
    );
  }

  const reasoningText = useMemo(
    () =>
      message.parts
        .filter((p) => p.type === "reasoning")
        .map((p) => p.text ?? "")
        .join(""),
    [message.parts]
  );
  const toolPods = message.toolPods ?? [];
  const hasActivity = reasoningText.trim().length > 0 || toolPods.length > 0 || isAssistantStreaming;
  const hasInjectedArtifact = message.parts.some((p) => p.type === "genui" || p.type === "quant-ui");

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex flex-col sm:flex-row justify-start w-full animate-fade-in",
        hideAssistantOrb ? "gap-0" : "gap-2 sm:gap-3"
      )}
    >
      {!hideAssistantOrb ? (
        <div className="flex items-center gap-2 sm:block max-sm:mb-1 shrink-0">
          <AssistantSiriOrb active={isAssistantStreaming} sizePx={28} className="mt-0.5" />
        </div>
      ) : null}
      <div className="w-full sm:max-w-[760px] min-w-0 flex-1 space-y-2 px-0.5">
        {hasActivity ? (
          <AgentActivity
            reasoning={reasoningText}
            toolPods={toolPods}
            isAssistantStreaming={isAssistantStreaming}
            liveStatus={message.liveStatus}
            liveStatusDetail={message.liveStatusDetail}
          />
        ) : null}

        {(() => {
          let lastTextIdx = -1;
          message.parts.forEach((p, i) => {
            if (p.type === "text" && p.text?.trim()) lastTextIdx = i;
          });
          return message.parts.map((part, idx) => {
            if (part.type === "trade-execution") {
              try {
                const trade = typeof part.text === "string" ? JSON.parse(part.text) : part.text;
                const currentSpotPrice =
                  livePrices && livePrices[trade.symbol]
                    ? livePrices[trade.symbol].spot
                    : trade.entryPrice;
                return (
                  <TradeReceiptCard
                    key={`${message.id}-${idx}`}
                    trade={trade}
                    currentPrice={currentSpotPrice}
                    onClosePosition={onClosePosition}
                  />
                );
              } catch {
                return null;
              }
            }
            if (part.type === "genui" && part.payload != null) {
              return <GenUiRenderer key={`${message.id}-${idx}`} payload={part.payload} />;
            }
            if (part.type === "quant-ui" && part.text?.includes("<quant:")) {
              return <QuantUiRenderer key={`${message.id}-${idx}`} markup={part.text} />;
            }
            if (part.type === "text" && part.text?.trim()) {
              let markdown = hasInjectedArtifact ? stripInjectedArtifactMarkdown(part.text) : part.text;
              markdown = stripInteractiveQuestionMarkup(markdown);
              if (!markdown.trim()) return null;
              return (
                <MarkdownContent
                  key={`${message.id}-${idx}`}
                  markdown={markdown}
                  isStreaming={!!isAssistantStreaming && idx === lastTextIdx}
                />
              );
            }
            return null;
          });
        })()}

        {guestSignInCta ? (
          <div className="mt-3 rounded-[16px] border border-white/[0.08] bg-white/[0.04] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <p className="text-xs text-zinc-400 leading-relaxed">
              Sign in free to save this thread, unlock deeper analysis, and access your demo wallet.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/login?next=/" className="terminal-btn terminal-btn-primary py-2 px-4 text-xs">
                Sign in
              </Link>
              <Link href="/signup" className="terminal-btn terminal-btn-ghost py-2 px-4 text-xs">
                Create account
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
