"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Brain, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { formatCountdown } from "@/lib/autonomous/cycle-config";
import { triggerWealthMonitorCycle } from "@/lib/autonomous/trigger-client";
import {
  ChatMessage,
  type ChatMessageData,
  type MessagePart,
} from "@/components/ai-elements/message";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";

type MonitorActivity = {
  id: string;
  phase: string;
  action: string;
  reasoning: string | null;
  payload?: Record<string, unknown>;
  cycle_id?: string | null;
  created_at: string;
};

type AttentionPayload = {
  nextCycleAt: string | null;
  remainingMs: number;
  cycleIntervalMs: number;
  attentionState: string;
  monitorRunning?: boolean;
  autonomousActive: boolean;
};

type MonitorPayload = {
  active: boolean;
  autonomousActive?: boolean;
  goalProfileMd: string | null;
  activity: MonitorActivity[];
  goal?: {
    id: string;
    nextWakeAt: string | null;
  } | null;
};

const WORKING_ACTIONS = new Set([
  "monitor_analyze",
  "monitor_directive",
  "monitor_review",
  "monitor_followup",
]);

function activityToChatMessage(item: MonitorActivity): ChatMessageData | null {
  const payloadReasoning = typeof item.payload?.reasoning === "string" ? item.payload.reasoning.trim() : "";
  const lineReasoning = typeof item.reasoning === "string" ? item.reasoning.trim() : "";
  const reasoning = payloadReasoning || lineReasoning;
  const summary = typeof item.payload?.summary === "string" ? item.payload.summary.trim() : "";
  const directive = typeof item.payload?.chatDirective === "string" ? item.payload.chatDirective.trim() : "";
  const followUp = typeof item.payload?.followUpDirective === "string" ? item.payload.followUpDirective.trim() : "";
  const taskComplete = item.payload?.taskComplete as boolean | undefined;
  const nextWakeMs = item.payload?.nextWakeMs as number | undefined;

  const parts: MessagePart[] = [];
  let liveStatus: string | undefined;
  let liveStatusDetail: string | undefined;

  switch (item.action) {
    case "monitor_analyze":
      liveStatus = "Analyzing account";
      if (reasoning) parts.push({ type: "reasoning", text: reasoning });
      parts.push({
        type: "text",
        text: reasoning || "Scanning account state, positions, and goal progress…",
      });
      break;
    case "monitor_goal_update":
      if (reasoning) parts.push({ type: "reasoning", text: reasoning });
      parts.push({
        type: "text",
        text: summary || reasoning || "Updated your goal profile.",
      });
      break;
    case "monitor_directive":
      liveStatus = "Executing growth strategy";
      if (reasoning) {
        parts.push({
          type: "reasoning",
          text: `${reasoning}\n\n---\nDecided the next autonomous action.`,
        });
      }
      if (directive) {
        parts.push({
          type: "text",
          text: `**Growth directive**\n\n${directive}`,
        });
      }
      break;
    case "monitor_review":
      liveStatus = "Reviewing trade outcome";
      if (reasoning) parts.push({ type: "reasoning", text: reasoning });
      {
        const chatOutput = typeof item.payload?.chatOutput === "string" ? item.payload.chatOutput.trim() : "";
        const reviewText =
          taskComplete === false
            ? "**Task incomplete** — scheduling a follow-up cycle."
            : "**Task complete** — monitoring until the next wake.";
        parts.push({
          type: "text",
          text: chatOutput ? `${reviewText}\n\n**Agent report:**\n\n${chatOutput}` : reviewText,
        });
      }
      break;
    case "monitor_followup":
      liveStatus = "Follow-up cycle";
      if (reasoning) parts.push({ type: "reasoning", text: reasoning });
      if (followUp) {
        parts.push({
          type: "text",
          text: `**Follow-up directive**\n\n${followUp}`,
        });
      }
      break;
    case "cycle_end":
      if (reasoning) parts.push({ type: "reasoning", text: reasoning });
      parts.push({
        type: "text",
        text:
          nextWakeMs != null
            ? `Cycle complete. Next wake in **${Math.round(nextWakeMs / 1000)}s**.`
            : reasoning || "Cycle complete.",
      });
      break;
    default:
      return null;
  }

  if (parts.length === 0) return null;

  return {
    id: item.id,
    role: "assistant",
    parts,
    liveStatus,
    liveStatusDetail: item.cycle_id ? `Cycle ${item.cycle_id.slice(0, 8)}` : undefined,
  };
}

function MonitorCountdownTimer({
  remainingMs,
  progress,
  isChecking,
  className,
}: {
  remainingMs: number;
  progress: number;
  isChecking: boolean;
  className?: string;
}) {
  const ringColor = isChecking
    ? "border-cyan-400/70"
    : "border-emerald-500/50";

  return (
    <div
      className={cn("relative flex shrink-0 items-center justify-center", className)}
      title={isChecking ? "Monitor analyzing…" : `Next wake in ${formatCountdown(remainingMs)}`}
    >
      <div
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-full border-2 bg-black/40",
          ringColor,
          isChecking && "shadow-[0_0_14px_rgba(34,211,238,0.35)]",
        )}
        style={
          !isChecking
            ? {
                background: `conic-gradient(rgb(52 211 153 / 0.45) ${progress}%, rgb(0 0 0 / 0.45) ${progress}%)`,
              }
            : undefined
        }
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--terminal-surface)]">
          {isChecking ? (
            <Loader2 className="size-3.5 animate-spin text-cyan-400" />
          ) : (
            <span className="text-[10px] font-bold tabular-nums leading-none text-emerald-300">
              {formatCountdown(remainingMs)}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

type Props = {
  className?: string;
};

export function WealthMonitorPanel({ className }: Props) {
  const [data, setData] = useState<MonitorPayload | null>(null);
  const [attention, setAttention] = useState<AttentionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"feed" | "goal">("feed");
  const [remainingMs, setRemainingMs] = useState(0);
  const [progress, setProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tickFiredRef = useRef(false);
  const triggerInFlightRef = useRef(false);
  const [triggering, setTriggering] = useState(false);

  const refreshMonitor = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/autonomous/monitor", { credentials: "include" });
      if (res.status === 401) return false;
      if (res.ok) {
        const json = (await res.json()) as MonitorPayload;
        setData(json);
      }
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
    return true;
  }, []);

  const refreshAttention = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/autonomous/attention", { credentials: "include" });
      if (res.status === 401) return false;
      if (res.ok) setAttention(await res.json());
    } catch {
      /* non-fatal */
    }
    return true;
  }, []);

  useEffect(() => {
    let authLost = false;

    const refreshAll = async () => {
      if (authLost) return;
      const [monitorOk, attentionOk] = await Promise.all([
        refreshMonitor(),
        refreshAttention(),
      ]);
      if (monitorOk === false || attentionOk === false) {
        authLost = true;
      }
    };

    void refreshAll();

    const es = new EventSource("/api/autonomous/stream");
    es.onmessage = (ev) => {
      if (authLost) return;
      try {
        const msg = JSON.parse(ev.data) as {
          type: string;
          items?: MonitorActivity[];
        };
        if (msg.type === "update") {
          const monitorItems = msg.items?.filter(
            (i) =>
              i.phase === "monitor" ||
              i.action?.startsWith("monitor_") ||
              i.action === "cycle_end",
          );
          if (monitorItems?.length) {
            setData((prev) => {
              if (!prev) return prev;
              const existing = new Set(prev.activity.map((a) => a.id));
              const merged = [...prev.activity];
              for (const item of monitorItems) {
                if (!existing.has(item.id)) merged.push(item);
              }
              return { ...prev, activity: merged.slice(-60) };
            });
          }
          void refreshAll();
        }
      } catch {
        /* ignore */
      }
    };

    const poll = window.setInterval(() => {
      void refreshAll();
    }, triggering ? 8_000 : 20_000);

    return () => {
      es.close();
      window.clearInterval(poll);
    };
  }, [refreshMonitor, refreshAttention, triggering]);

  useEffect(() => {
    const nextAt = attention?.nextCycleAt ?? data?.goal?.nextWakeAt;
    const intervalMs = attention?.cycleIntervalMs ?? 120_000;
    const goalId = data?.goal?.id;
    const autonomousOn =
      data?.autonomousActive ?? data?.active ?? attention?.autonomousActive ?? false;

    if (!nextAt) {
      setRemainingMs(attention?.remainingMs ?? 0);
      setProgress(0);
      return;
    }

    const tick = () => {
      const rem = Math.max(0, new Date(nextAt).getTime() - Date.now());
      setRemainingMs(rem);
      setProgress(Math.min(100, ((intervalMs - rem) / intervalMs) * 100));

      const monitorBusy = attention?.monitorRunning || triggerInFlightRef.current;

      if (rem <= 0 && !tickFiredRef.current && !monitorBusy && autonomousOn) {
        tickFiredRef.current = true;
        triggerInFlightRef.current = true;
        setTriggering(true);
        void triggerWealthMonitorCycle(goalId)
          .then(() => {
            void refreshMonitor();
            void refreshAttention();
          })
          .finally(() => {
            triggerInFlightRef.current = false;
            setTriggering(false);
          });
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [
    attention?.nextCycleAt,
    attention?.cycleIntervalMs,
    attention?.remainingMs,
    attention?.autonomousActive,
    attention?.monitorRunning,
    data?.goal?.nextWakeAt,
    data?.goal?.id,
    data?.autonomousActive,
    data?.active,
    refreshMonitor,
    refreshAttention,
  ]);

  useEffect(() => {
    tickFiredRef.current = false;
  }, [attention?.nextCycleAt, data?.goal?.nextWakeAt]);

  const isWorking = useMemo(() => {
    if (triggering) return true;
    if (attention?.monitorRunning || attention?.attentionState === "checking") return true;
    return (data?.activity ?? []).some(
      (a) =>
        WORKING_ACTIONS.has(a.action) &&
        Date.now() - new Date(a.created_at).getTime() < 120_000,
    );
  }, [data?.activity, attention, triggering]);

  const chatMessages = useMemo(() => {
    return (data?.activity ?? [])
      .map(activityToChatMessage)
      .filter((m): m is ChatMessageData => m != null);
  }, [data?.activity]);

  const streamingMessage = useMemo((): ChatMessageData | null => {
    if (!isWorking) return null;
    const latest = [...(data?.activity ?? [])]
      .reverse()
      .find((a) => WORKING_ACTIONS.has(a.action));
    const label =
      latest?.action === "monitor_directive"
        ? "Executing growth strategy"
        : latest?.action === "monitor_review"
          ? "Reviewing trade outcome"
          : latest?.action === "monitor_followup"
            ? "Follow-up cycle"
            : "Analyzing account";

    return {
      id: "monitor-streaming",
      role: "assistant",
      parts: [
        {
          type: "reasoning",
          text:
            typeof latest?.payload?.reasoning === "string"
              ? latest.payload.reasoning
              : typeof latest?.reasoning === "string"
                ? latest.reasoning
                : "Evaluating positions, goal progress, and market context…",
        },
      ],
      liveStatus: label,
    };
  }, [isWorking, data?.activity]);

  useEffect(() => {
    if (scrollRef.current && tab === "feed") {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, streamingMessage, tab]);

  const showPanel =
    data?.autonomousActive ?? data?.active ?? attention?.autonomousActive ?? false;

  if (loading) {
    return (
      <aside
        className={cn(
          "flex h-full w-96 shrink-0 flex-col border-l border-white/8 bg-[var(--terminal-surface)]/80",
          className,
        )}
      >
        <div className="flex flex-1 items-center justify-center text-xs text-zinc-500">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading monitor…
        </div>
      </aside>
    );
  }

  if (!showPanel) return null;

  const isChecking = isWorking || attention?.attentionState === "checking";

  return (
    <aside
      className={cn(
        "flex h-full w-96 shrink-0 flex-col border-l border-white/8 bg-[var(--terminal-surface)]/80",
        className,
      )}
    >
      <header className="shrink-0 border-b border-white/8 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
            <Brain className="size-3.5 text-emerald-400" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-zinc-100">Wealth Monitor</p>
            <p className="truncate text-[10px] text-zinc-500">
              {isChecking
                ? triggering
                  ? "Waking Wealth Monitor…"
                  : "Analyzing account & executing growth strategy…"
                : "Supervising your goal"}
            </p>
          </div>
          <MonitorCountdownTimer
            remainingMs={remainingMs}
            progress={progress}
            isChecking={isChecking}
          />
        </div>

        <div className="mt-2 flex gap-1 rounded-lg bg-white/5 p-0.5">
          {(["feed", "goal"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                tab === t
                  ? "bg-white/10 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              {t === "feed" ? "Reasoning" : "goal.md"}
            </button>
          ))}
        </div>
      </header>

      {tab === "goal" ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 text-xs text-zinc-300 scrollbar-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="mb-2 text-sm font-bold text-zinc-100">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="mb-1.5 mt-3 text-xs font-semibold text-cyan-300">{children}</h2>
              ),
              p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
              li: ({ children }) => <li className="mb-0.5 ml-4 list-disc">{children}</li>,
              strong: ({ children }) => (
                <strong className="font-semibold text-zinc-100">{children}</strong>
              ),
            }}
          >
            {data?.goalProfileMd ?? "_No goal profile yet._"}
          </ReactMarkdown>
        </div>
      ) : (
        <Conversation className="min-h-0 flex-1">
          <ConversationContent ref={scrollRef} className="space-y-6 px-3 py-4">
            {chatMessages.length === 0 && !streamingMessage ? (
              <ChatMessage
                message={{
                  id: "monitor-idle",
                  role: "assistant",
                  parts: [
                    {
                      type: "text",
                      text: `Autonomous trading is on. I'll analyze your account when the timer reaches zero (**${formatCountdown(remainingMs)}** remaining).`,
                    },
                  ],
                }}
              />
            ) : null}
            {chatMessages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {streamingMessage ? (
              <ChatMessage message={streamingMessage} isAssistantStreaming />
            ) : null}
          </ConversationContent>
          <ConversationScrollButton bottomOffset="bottom-12" className="border-white/8 bg-[var(--terminal-surface)] text-zinc-300 hover:text-white" />
        </Conversation>
      )}

      <footer className="shrink-0 border-t border-white/8 px-3 py-2">
        <p className="text-[9px] leading-relaxed text-zinc-600">
          Read-only activity feed for the autonomous growth manager on Investing.
        </p>
      </footer>
    </aside>
  );
}
