"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Brain, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChartContext } from "@/contexts/chart-context";
import { ChatMessage as ChatMessageBubble } from "@/components/ai-elements/message";
import { AssistantPixelAvatar } from "@/components/ai-elements/agent-pixel-avatar";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import InputBar, { type TaggedAsset } from "@/components/ui/input-bar";
import type { ChatStreamEvent, ChatToolPod } from "@/lib/chat/stream-types";
import type { SubAgentState } from "@/lib/chat/subagent-types";
import { normalizeSubAgentList } from "@/lib/chat/subagent-types";
import { applySubagentStreamEvent } from "@/lib/chat/subagent-stream";
import {
  buildActivityTimeline,
  type ActivityPartRef,
  applyUserUpdateToParts,
} from "@/lib/chat/activity-timeline";
import { deriveLiveTraceFromSteps, LIVE_TRACE_PLANNING } from "@/lib/chat/live-trace";
import { AgentDetailPane } from "@/components/workspace/agent-detail-pane";
import { ResizablePane } from "@/components/ui/resizable-pane";
import { ChatWidgetProvider } from "@/contexts/chat-widget-context";
import { formatUserDisplayMessage, toPinnedAssetRef } from "@/lib/chat/pinned-assets";
import { buildHistoryFromMessages } from "@/lib/chat/conversation-history";
import type { AiToolId } from "@/lib/chat/ai-tools";
import type { MarketsAnalysisPreset } from "@/lib/chat/markets-chart-context";

interface MessagePart {
  type:
    | "reasoning"
    | "text"
    | "tool_ref"
    | "user_update"
    | "genui"
    | "quant-ui";
  text?: string;
  toolUseId?: string;
  payload?: unknown;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
  toolPods?: ChatToolPod[];
  subAgents?: SubAgentState[];
  liveStatus?: string;
  liveStatusDetail?: string;
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

function appendReasoningPart(parts: MessagePart[], text: string): MessagePart[] {
  const next = [...parts];
  const last = next[next.length - 1];
  if (last?.type === "reasoning") {
    next[next.length - 1] = { ...last, text: (last.text ?? "") + text };
  } else {
    next.push({ type: "reasoning", text });
  }
  return next;
}

function appendToolRefPart(parts: MessagePart[], toolUseId: string): MessagePart[] {
  if (parts.some((p) => p.type === "tool_ref" && p.toolUseId === toolUseId)) {
    return parts;
  }
  return [...parts, { type: "tool_ref", toolUseId }];
}

function liveStatusFromMessage(
  parts: MessagePart[] | ActivityPartRef[],
  toolPods: ChatToolPod[],
  fallback?: string,
): string | undefined {
  const activityParts: ActivityPartRef[] = parts.map((p) => {
    if ("toolUseId" in p && p.toolUseId) {
      return { type: "tool_ref" as const, toolUseId: p.toolUseId };
    }
    if (p.type === "user_update") {
      return { type: "user_update" as const, text: (p as { text?: string }).text };
    }
    return { type: "reasoning" as const, text: (p as { text?: string }).text };
  });
  const steps = buildActivityTimeline(activityParts, toolPods, true);
  return deriveLiveTraceFromSteps(steps, fallback ?? LIVE_TRACE_PLANNING);
}

export function MarketsChatPanel({
  open,
  onToggle,
  fullWidth,
  hideCollapseOnMobile,
}: {
  open: boolean;
  onToggle: () => void;
  fullWidth?: boolean;
  hideCollapseOnMobile?: boolean;
}) {
  const { symbol, tvSymbol, displayName, interval, indicators } = useChartContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [openAgentId, setOpenAgentId] = useState<string | null>(null);
  const [taggedAssets, setTaggedAssets] = useState<TaggedAsset[]>([]);
  const [selectedAiTools, setSelectedAiTools] = useState<AiToolId[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pendingScrollRef = useRef(false);

  const openAgent = messages
    .flatMap((m) => m.subAgents ?? [])
    .find((a) => a.id === openAgentId) ?? null;

  useEffect(() => {
    if (pendingScrollRef.current && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      pendingScrollRef.current = false;
    }
  }, [messages]);

  useEffect(() => {
    if (open) {
      setMessages([]);
      setOpenAgentId(null);
    }
  }, [symbol, open]);

  const removeTaggedAsset = useCallback((sym: string) => {
    setTaggedAssets((prev) => prev.filter((t) => t.symbol !== sym));
  }, []);

  const toggleTaggedAsset = useCallback((sym: string) => {
    setTaggedAssets((prev) => {
      if (prev.some((t) => t.symbol === sym)) {
        return prev.filter((t) => t.symbol !== sym);
      }
      if (prev.length >= 5) return prev;
      return [...prev, { symbol: sym }];
    });
  }, []);

  const handleWidgetAction = useCallback(() => {
    // Widget actions can be handled here if needed
  }, []);

  const handleSend = useCallback(
    async (
      textToSend: string,
      pinnedForSend: TaggedAsset[] = [],
      options?: { analysisPreset?: MarketsAnalysisPreset },
    ) => {
      const userText = textToSend.trim();
      const displayPrompt = formatUserDisplayMessage(userText, pinnedForSend);
      if (!displayPrompt && pinnedForSend.length === 0) return;
      if (loading) return;

      const apiMessage =
        userText ||
        (pinnedForSend.length > 0
          ? "Give a concise outlook with key levels and risk considerations for each pinned asset."
          : "");
      const pinnedAssets = pinnedForSend.map(toPinnedAssetRef);

      const userMsgId = crypto.randomUUID();
      const assistantMsgId = crypto.randomUUID();

      const userMessage: ChatMessage = {
        id: userMsgId,
        role: "user",
        parts: [{ type: "text", text: displayPrompt }],
      };

      const assistantMessage: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        parts: [],
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setValue("");
      pendingScrollRef.current = true;
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const history = buildHistoryFromMessages(
          messages.map((m) => ({
            role: m.role,
            parts: m.parts.map((p) => ({
              type: p.type,
              text: p.text,
              toolUseId: p.toolUseId,
            })),
          })),
        );

        const chartContext = `[Analyzing ${symbol} (${displayName}) on ${interval} timeframe with indicators: ${indicators.join(", ") || "None"}]`;

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            message: `${chartContext}\n\n${apiMessage}`,
            pinnedAssets: [{ symbol, name: displayName }, ...pinnedAssets],
            aiTools:
              selectedAiTools.length > 0
                ? selectedAiTools
                : (["analyzeChart", "deepResearch"] as AiToolId[]),
            history,
            tradingMode: "demo",
            sessionContext: {
              chartSymbol: symbol,
              chartInterval: interval,
              chartIndicators: indicators,
              tvSymbol,
              displayName,
              analysisPreset: options?.analysisPreset,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`Request failed (${response.status})`);
        }

        if (!response.body) {
          throw new Error("Response body is not readable");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value: chunk, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(chunk, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
              const event = JSON.parse(trimmed) as ChatStreamEvent;

              setMessages((prev) => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (!lastMsg || lastMsg.id !== assistantMsgId) return prev;

                if (event.type === "user_update") {
                  const activityParts = activityPartsFromMessage(lastMsg.parts);
                  const nextActivityParts = applyUserUpdateToParts(activityParts, event.message);
                  const parts: MessagePart[] = [
                    ...lastMsg.parts,
                    { type: "user_update", text: event.message },
                  ];
                  updated[updated.length - 1] = {
                    ...lastMsg,
                    parts,
                    liveStatus: liveStatusFromMessage(nextActivityParts, lastMsg.toolPods ?? []),
                  };
                  return updated;
                }

                if (event.type === "reasoning") {
                  const parts = appendReasoningPart(lastMsg.parts, event.text);
                  updated[updated.length - 1] = {
                    ...lastMsg,
                    parts,
                    liveStatus: liveStatusFromMessage(parts, lastMsg.toolPods ?? [], lastMsg.liveStatus),
                  };
                  return updated;
                }

                if (event.type === "text") {
                  const parts = [...lastMsg.parts];
                  const lastPart = parts[parts.length - 1];
                  if (lastPart && lastPart.type === "text") {
                    parts[parts.length - 1] = { ...lastPart, text: (lastPart.text ?? "") + event.text };
                  } else {
                    parts.push({ type: "text", text: event.text });
                  }
                  updated[updated.length - 1] = {
                    ...lastMsg,
                    parts,
                    liveStatus: undefined,
                  };
                  return updated;
                }

                if (event.type === "genui") {
                  const parts = [...lastMsg.parts, { type: "genui" as const, payload: event.payload }];
                  updated[updated.length - 1] = { ...lastMsg, parts, liveStatus: undefined };
                  return updated;
                }

                if (event.type === "quant_ui") {
                  const parts = [...lastMsg.parts, { type: "quant-ui" as const, text: event.markup }];
                  updated[updated.length - 1] = { ...lastMsg, parts, liveStatus: undefined };
                  return updated;
                }

                if (event.type === "status") {
                  updated[updated.length - 1] = {
                    ...lastMsg,
                    liveStatus: event.label,
                    liveStatusDetail: event.detail,
                  };
                  return updated;
                }

                if (event.type === "tool_start") {
                  const pods = [...(lastMsg.toolPods ?? [])];
                  const i = pods.findIndex((p) => p.toolUseId === event.toolUseId);
                  if (i >= 0) {
                    pods[i] = { ...pods[i], name: event.name, status: "running", args: event.args };
                  } else {
                    pods.push({ toolUseId: event.toolUseId, name: event.name, status: "running", args: event.args });
                  }
                  const parts = appendToolRefPart(lastMsg.parts, event.toolUseId);
                  updated[updated.length - 1] = {
                    ...lastMsg,
                    parts,
                    toolPods: pods,
                    liveStatus: liveStatusFromMessage(parts, pods, lastMsg.liveStatus),
                  };
                  return updated;
                }

                if (event.type === "tool_end") {
                  const pods = [...(lastMsg.toolPods ?? [])];
                  const i = pods.findIndex((p) => p.toolUseId === event.toolUseId);
                  const done: ChatToolPod = {
                    toolUseId: event.toolUseId,
                    name: event.name,
                    status: "done",
                    ok: event.ok,
                    args: event.args,
                    output: event.output,
                    error: event.error,
                    durationMs: event.durationMs,
                  };
                  if (i >= 0) {
                    pods[i] = done;
                  } else {
                    pods.push(done);
                  }
                  updated[updated.length - 1] = {
                    ...lastMsg,
                    toolPods: pods,
                    liveStatus: liveStatusFromMessage(lastMsg.parts, pods, lastMsg.liveStatus),
                  };
                  return updated;
                }

                if (event.type === "subagent_start") {
                  const subAgents = normalizeSubAgentList(lastMsg.subAgents) ?? [];
                  const next = applySubagentStreamEvent(subAgents, event);
                  if (next) {
                    updated[updated.length - 1] = { ...lastMsg, subAgents: next };
                  }
                  return updated;
                }

                if (
                  event.type === "subagent_reasoning" ||
                  event.type === "subagent_update" ||
                  event.type === "subagent_text" ||
                  event.type === "subagent_tool_start" ||
                  event.type === "subagent_tool_end" ||
                  event.type === "subagent_end"
                ) {
                  const subAgents = normalizeSubAgentList(lastMsg.subAgents) ?? [];
                  const next = applySubagentStreamEvent(subAgents, event);
                  if (next) {
                    updated[updated.length - 1] = { ...lastMsg, subAgents: next };
                  }
                  return updated;
                }

                return prev;
              });
            } catch {
              /* skip malformed */
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setMessages((prev) => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg?.id === assistantMsgId) {
            updated[updated.length - 1] = {
              ...lastMsg,
              parts: [{ type: "text", text: `Error: ${(err as Error).message}` }],
            };
          }
          return updated;
        });
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [loading, symbol, tvSymbol, displayName, interval, indicators, messages, selectedAiTools],
  );


  if (!open) {
    return (
      <div className="flex h-full w-10 shrink-0 flex-col items-center border-l border-white/6 bg-black/30 py-3 max-lg:hidden">
        <button
          type="button"
          onClick={onToggle}
          className="rounded-lg p-2 text-cyan-400 hover:bg-cyan-500/10"
          title="Open AI Chat"
        >
          <Brain className="size-4" />
        </button>
      </div>
    );
  }

  const visibleMessages = messages.filter(
    (m) => m.parts.length > 0 || m.toolPods?.length || m.subAgents?.length || m.liveStatus,
  );

  return (
    <ChatWidgetProvider onWidgetAction={handleWidgetAction}>
      <aside
        className={cn(
          "flex h-full shrink-0 flex-col border-l border-white/6 bg-[var(--terminal-surface)]",
          fullWidth ? "w-full max-w-none" : "w-[min(440px,42vw)]",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-white/6 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <AssistantPixelAvatar active={loading} sizePx={24} />
            <div>
              <p className="text-xs font-bold text-white">Chart Analyst</p>
              <p className="text-[10px] text-zinc-500">{symbol} · {interval}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              "rounded-lg p-1.5 text-zinc-500 hover:text-zinc-300",
              hideCollapseOnMobile && "max-lg:hidden",
            )}
            title="Collapse panel"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Main content area */}
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {/* Chat area */}
          <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
            {visibleMessages.length === 0 ? (
              /* Empty state with quick prompts */
              <div className="flex flex-1 flex-col items-center justify-center p-4">
                <div className="mb-4 text-center">
                  <p className="mb-1 text-sm font-medium text-white">
                    Ask about {displayName}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Get technical analysis, key levels, entry setups, and trading ideas
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void handleSend("Run full agent analysis on this chart", [], {
                        analysisPreset: "full-chart-analysis",
                      })
                    }
                    disabled={loading}
                    className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50"
                  >
                    Full agent analysis
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void handleSend("Run daily market regime scan", [], {
                        analysisPreset: "daily-regime-scan",
                      })
                    }
                    disabled={loading}
                    className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200 transition hover:bg-violet-500/20 disabled:opacity-50"
                  >
                    Daily regime scan
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void handleSend("Scan for swing opportunities", [], {
                        analysisPreset: "swing-opportunity-scan",
                      })
                    }
                    disabled={loading}
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    Swing opportunity scan
                  </button>
                  {[
                    "Key support & resistance",
                    "Best entry setup",
                    "Risk/reward analysis",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void handleSend(prompt, [])}
                      disabled={loading}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/[0.06] disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Messages area - same structure as main chat */
              <div className="relative flex min-h-0 flex-1 flex-col">
                <Conversation className="min-h-0 flex-1 pb-24">
                  <ConversationContent
                    ref={chatScrollRef}
                    className="space-y-6 bg-transparent"
                  >
                    <div className="mx-auto w-full max-w-full space-y-6 px-3">
                      {visibleMessages.map((message, messageIndex) => {
                        const isLastMessage = messageIndex === visibleMessages.length - 1;
                        return (
                          <ChatMessageBubble
                            key={message.id}
                            message={{
                              id: message.id,
                              role: message.role,
                              parts: message.parts.map((p) => {
                                if (p.type === "quant-ui") {
                                  return { type: "quant-ui" as const, payload: p.text };
                                }
                                return p;
                              }),
                              toolPods: message.toolPods,
                              subAgents: message.subAgents,
                              liveStatus: message.liveStatus,
                              liveStatusDetail: message.liveStatusDetail,
                            }}
                            isAssistantStreaming={loading && isLastMessage && message.role === "assistant"}
                            onOpenAgentDetail={(agent) => setOpenAgentId(agent.id)}
                          />
                        );
                      })}
                    </div>
                  </ConversationContent>
                  <ConversationScrollButton className="border-white/8 bg-[var(--terminal-surface)] text-zinc-300 hover:text-white" />
                </Conversation>

                {/* Input bar - same as main chat */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--terminal-surface)] via-[var(--terminal-surface)]/95 to-transparent pb-3 pt-6">
                  <div className="relative mx-auto w-full max-w-full px-3">
                    <InputBar
                      value={value}
                      onChange={setValue}
                      onSend={({ content }) => {
                        const tags = [...taggedAssets];
                        setTaggedAssets([]);
                        void handleSend(content, tags);
                      }}
                      disabled={loading}
                      status={loading ? "streaming" : "ready"}
                      placeholder="Ask about this chart..."
                      variant="landing"
                      taggedAssets={taggedAssets}
                      onRemoveTaggedAsset={removeTaggedAsset}
                      onToggleTaggedAsset={toggleTaggedAsset}
                      maxTaggedAssets={5}
                      selectedAiTools={selectedAiTools}
                      onSelectedAiToolsChange={setSelectedAiTools}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Agent detail pane */}
          {openAgent ? (
            <ResizablePane
              minWidth={280}
              maxWidth={400}
              defaultWidth={320}
              side="right"
              className="shrink-0"
            >
              <AgentDetailPane
                agent={openAgent}
                onClose={() => setOpenAgentId(null)}
                className="h-full w-full"
              />
            </ResizablePane>
          ) : null}
        </div>
      </aside>
    </ChatWidgetProvider>
  );
}
