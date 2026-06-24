"use client";

import { cn } from "@/lib/utils";
import { AgentOrb } from "@/components/ai-elements/agent-orb";
import { subAgentWidgetTrace } from "@/lib/chat/live-trace";
import type { SubAgentColorScheme, SubAgentState } from "@/lib/chat/subagent-types";

const SUBAGENT_ACCENT: Record<SubAgentColorScheme, string> = {
  cyan: "text-cyan-400",
  blue: "text-blue-400",
  violet: "text-violet-400",
  amber: "text-amber-400",
  rose: "text-rose-400",
  emerald: "text-emerald-400",
};

function TypingDots() {
  return (
    <span className="inline-flex shrink-0 items-end gap-[3px]" aria-hidden>
      <span className="inline-block size-[4px] animate-bounce rounded-full bg-[#24ee89] [animation-duration:0.6s]" />
      <span className="inline-block size-[4px] animate-bounce rounded-full bg-[#24ee89] [animation-duration:0.6s] [animation-delay:0.12s]" />
      <span className="inline-block size-[4px] animate-bounce rounded-full bg-[#24ee89] [animation-duration:0.6s] [animation-delay:0.24s]" />
    </span>
  );
}

export function SubAgentWidget({
  agent,
  onClick,
}: {
  agent: SubAgentState;
  onClick?: () => void;
}) {
  const isRunning = agent.status === "running";
  const isFailed = agent.status === "failed";
  const accent = SUBAGENT_ACCENT[agent.color] ?? "text-[#24ee89]";
  const trace = subAgentWidgetTrace(agent);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full min-w-0 items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
        "border-white/[0.08] bg-white/[0.03]",
        "hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/40",
        isRunning && "border-white/[0.12] bg-white/[0.04]",
      )}
    >
      <AgentOrb
        colorScheme={agent.color}
        active={isRunning}
        sizePx={22}
        className="shrink-0"
      />
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span
          className={cn(
            "min-w-0 truncate text-[11px] font-medium leading-snug",
            isRunning ? cn("text-shimmer", accent) : isFailed ? "text-red-400/90" : "text-zinc-400",
          )}
        >
          {trace}
        </span>
        {isRunning ? <TypingDots /> : null}
      </div>
      <div className="shrink-0 text-right">
        <span
          className={cn(
            "text-[10px] font-medium",
            isRunning ? "text-[#24ee89]" : isFailed ? "text-red-400" : "text-emerald-400/90",
          )}
        >
          {isRunning ? "Running" : isFailed ? "Failed" : "Done"}
        </span>
        {!isRunning && agent.durationMs != null ? (
          <p className="text-[9px] text-zinc-600">{agent.durationMs}ms</p>
        ) : null}
      </div>
    </button>
  );
}

export function SubAgentWidgetRow({
  agents,
  onOpenAgent,
}: {
  agents: SubAgentState[];
  onOpenAgent?: (agent: SubAgentState) => void;
}) {
  if (agents.length === 0) return null;

  return (
    <div className="mb-2 flex w-full flex-col gap-1.5">
      {agents.map((agent) => (
        <SubAgentWidget
          key={agent.id}
          agent={agent}
          onClick={onOpenAgent ? () => onOpenAgent(agent) : undefined}
        />
      ))}
    </div>
  );
}
