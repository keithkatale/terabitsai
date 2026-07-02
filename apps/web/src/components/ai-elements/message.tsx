"use client";

import * as React from "react";
import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AssistantSiriOrb } from "./assistant-siri-orb";
import { AgentActivity } from "./agent-activity";
import { SubAgentWidgetRow } from "./sub-agent-widget";
import { UserUpdateMessage } from "./user-update-message";
import { MarkdownContent } from "./markdown-content";
import { GenUiRenderer } from "@/components/generative-ui/genui-renderer";
import { QuantUiRenderer } from "@/components/quant-ui/quant-ui-renderer";
import { stripGenuiFences } from "@/lib/genui/strip-genui-fences";
import { stripInjectedArtifactMarkdown } from "@/lib/genui/strip-artifact-fences";
import { stripInteractiveQuestionMarkup } from "@/lib/chat/interactive-question-helper";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
import type { ChatToolPod } from "@/lib/chat/stream-types";
import type { ActivityPartRef } from "@/lib/chat/activity-timeline";
import { buildActivityTimeline } from "@/lib/chat/activity-timeline";
import { deriveLiveTraceFromSteps } from "@/lib/chat/live-trace";
import type { SubAgentState } from "@/lib/chat/subagent-types";

export interface MessagePart {
  type:
    | "reasoning"
    | "text"
    | "tool_ref"
    | "user_update"
    | "trade-execution"
    | "genui"
    | "quant-ui"
    | "canvas"
    | "monitor_directive"
    | "session_divider";
  text?: string;
  toolUseId?: string;
  payload?: unknown;
  html?: string;
  title?: string;
}

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant" | "system";
  parts: MessagePart[];
  toolPods?: ChatToolPod[];
  subAgents?: SubAgentState[];
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

function activityPartsFromMessage(parts: MessagePart[]): ActivityPartRef[] {
  return parts
    .filter((p) => p.type === "reasoning" || p.type === "tool_ref" || p.type === "user_update")
    .map((p) => {
      if (p.type === "tool_ref" && p.toolUseId) {
        return { type: "tool_ref" as const, toolUseId: p.toolUseId };
      }
      if (p.type === "user_update") {
        return { type: "user_update" as const, text: p.text };
      }
      return { type: "reasoning" as const, text: p.text };
    });
}

function AgentActivityBridge({
  reasoning,
  toolPods,
  isAssistantStreaming,
  liveStatus,
  liveStatusDetail,
  collapsed,
  activityParts,
}: {
  reasoning: string;
  toolPods: ChatToolPod[];
  isAssistantStreaming: boolean;
  liveStatus?: string;
  liveStatusDetail?: string;
  collapsed?: boolean;
  activityParts?: ActivityPartRef[];
}) {
  const steps = buildActivityTimeline(activityParts ?? [], toolPods, isAssistantStreaming);
  const traceLabel = deriveLiveTraceFromSteps(steps, liveStatus);

  return (
    <AgentActivity
      reasoning={reasoning}
      toolPods={toolPods}
      isStreaming={isAssistantStreaming}
      liveStatus={traceLabel}
      liveStatusDetail={liveStatusDetail}
      collapsed={collapsed}
      activityParts={activityParts}
    />
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
  onOpenAgentDetail,
  guestSignInCta = false,
  rootRef,
  hideVisualWidgets = false,
  suppressChartEmbeds = false,
}: {
  message: ChatMessageData;
  isAssistantStreaming?: boolean;
  hideAssistantOrb?: boolean;
  livePrices?: Record<string, { spot: number }>;
  onClosePosition?: (id: string) => void;
  onOpenAgentDetail?: (agent: SubAgentState) => void;
  guestSignInCta?: boolean;
  rootRef?: React.Ref<HTMLDivElement | null>;
  hideVisualWidgets?: boolean;
  suppressChartEmbeds?: boolean;
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
          <div className="max-w-[85%] rounded-xl border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-2.5 text-sm leading-relaxed text-zinc-100">
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
        <div className="max-w-[85%] whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-900/60 px-3.5 py-2.5 text-sm leading-relaxed text-zinc-200">
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
  const subAgents = message.subAgents ?? [];
  const activityParts = useMemo(() => activityPartsFromMessage(message.parts), [message.parts]);
  const hasRunningSubAgents =
    isAssistantStreaming && subAgents.some((a) => a.status === "running");
  const hasActivity = reasoningText.trim().length > 0 || toolPods.length > 0 || isAssistantStreaming;
  const hasInjectedArtifact = message.parts.some((p) => p.type === "genui" || p.type === "quant-ui");

  // Extract user updates for separate display
  const userUpdates = useMemo(() => {
    const allUpdates = message.parts.filter((p) => p.type === "user_update" && p.text?.trim());
    if (allUpdates.length === 0) return [];
    const lastUpdate = allUpdates[allUpdates.length - 1];
    return [{
      id: "update-latest",
      text: lastUpdate.text ?? "",
    }];
  }, [message.parts]);

  const hasFinalText = message.parts.some((p) => p.type === "text" && p.text?.trim());

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
      <div className="w-full min-w-0 flex-1 space-y-2 px-0.5">
        {hasActivity ? (
          <AgentActivityBridge
            reasoning={reasoningText}
            toolPods={toolPods}
            isAssistantStreaming={isAssistantStreaming}
            liveStatus={message.liveStatus}
            liveStatusDetail={message.liveStatusDetail}
            collapsed={hasRunningSubAgents}
            activityParts={activityParts}
          />
        ) : null}

        {subAgents.length > 0 ? (
          <SubAgentWidgetRow agents={subAgents} onOpenAgent={onOpenAgentDetail} />
        ) : null}

        <UserUpdateMessage
          updates={userUpdates}
          isStreaming={!!isAssistantStreaming}
          hasFinalText={hasFinalText}
        />

        {(() => {
          let lastTextIdx = -1;
          message.parts.forEach((p, i) => {
            if (p.type === "text" && p.text?.trim()) lastTextIdx = i;
          });
          return message.parts.map((part, idx) => {
            if (part.type === "trade-execution") {
              if (hideVisualWidgets) {
                return (
                  <div key={`${message.id}-${idx}`} className="my-1 inline-flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-xs text-emerald-400 font-semibold uppercase tracking-wider">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Trade Receipt Loaded on Canvas
                  </div>
                );
              }
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
              if (hideVisualWidgets) {
                return (
                  <div key={`${message.id}-${idx}`} className="my-1 inline-flex items-center gap-1.5 rounded-md border border-cyan-500/20 bg-cyan-500/5 px-2.5 py-1 text-xs text-cyan-400 font-semibold uppercase tracking-wider">
                    <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    Visualization Loaded on Canvas
                  </div>
                );
              }
              return (
                <GenUiRenderer
                  key={`${message.id}-${idx}`}
                  payload={part.payload}
                  suppressChartEmbeds={suppressChartEmbeds}
                />
              );
            }
            if (part.type === "quant-ui" && part.text?.includes("<quant:")) {
              if (hideVisualWidgets) {
                return (
                  <div key={`${message.id}-${idx}`} className="my-1 inline-flex items-center gap-1.5 rounded-md border border-cyan-500/20 bg-cyan-500/5 px-2.5 py-1 text-xs text-cyan-400 font-semibold uppercase tracking-wider">
                    <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    Visualization Loaded on Canvas
                  </div>
                );
              }
              if (suppressChartEmbeds && /<quant:(chart|compare)/i.test(part.text)) {
                return null;
              }
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
