"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentOrb } from "@/components/ai-elements/agent-orb";
import { AgentActivity, AgentLiveTrace } from "@/components/ai-elements/agent-activity";
import { MarkdownContent } from "@/components/ai-elements/markdown-content";
import { subAgentPromptLabel, type SubAgentState } from "@/lib/chat/subagent-types";

export function AgentDetailPane({
  agent,
  onClose,
  className,
}: {
  agent: SubAgentState;
  onClose: () => void;
  className?: string;
}) {
  const isRunning = agent.status === "running";
  const reportText = agent.report?.trim() ?? "";
  const hasActivity =
    agent.reasoning.trim().length > 0 || agent.toolPods.length > 0 || isRunning;

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full max-w-md flex-col border-l border-white/[0.08] bg-[#050508]/95 backdrop-blur-md",
        className,
      )}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-white/[0.08] px-3 py-2.5">
        <AgentOrb colorScheme={agent.color} active={isRunning} sizePx={24} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-100">
            {subAgentPromptLabel(agent.prompt, 72)}
          </p>
          <p className="text-[10px] text-zinc-500">
            {isRunning ? "Running" : agent.status === "failed" ? "Failed" : "Done"}
            {agent.durationMs != null && !isRunning ? ` · ${agent.durationMs}ms` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
          aria-label="Close agent detail"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <section className="mb-4">
          <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Prompt
          </h3>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-[12px] leading-relaxed text-zinc-300">
            <p className="whitespace-pre-wrap">{agent.prompt}</p>
          </div>
        </section>

        <div className="space-y-2">
          {hasActivity ? (
            isRunning ? (
              <AgentLiveTrace
                reasoning={agent.reasoning}
                toolPods={agent.toolPods}
                liveStatus={agent.liveTrace}
                accentClassName="text-cyan-400"
                labelOnly
                activitySteps={agent.activitySteps}
              />
            ) : (
              <AgentActivity
                reasoning={agent.reasoning}
                toolPods={agent.toolPods}
                isStreaming={false}
                activitySteps={agent.activitySteps}
              />
            )
          ) : null}

          {agent.status === "failed" ? (
            <p className="text-[13px] leading-relaxed text-red-400">
              {agent.error ?? "Sub-agent failed."}
            </p>
          ) : reportText ? (
            <MarkdownContent markdown={reportText} isStreaming={isRunning} />
          ) : isRunning ? null : (
            <p className="text-[11px] text-zinc-600">No report returned.</p>
          )}
        </div>
      </div>
    </aside>
  );
}
