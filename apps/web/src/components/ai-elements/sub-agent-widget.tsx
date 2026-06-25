"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentOrb } from "@/components/ai-elements/agent-orb";
import { TraceShimmerText } from "@/components/ai-elements/shimmer";
import { subAgentWidgetTrace } from "@/lib/chat/live-trace";
import {
  leadSubAgent,
  sortAgentsForOrbStack,
  type SubAgentColorScheme,
  type SubAgentState,
} from "@/lib/chat/subagent-types";

const SUBAGENT_HIGHLIGHT: Record<SubAgentColorScheme, string> = {
  cyan: "#22d3ee",
  blue: "#60a5fa",
  violet: "#a78bfa",
  amber: "#fbbf24",
  rose: "#fb7185",
  emerald: "#34d399",
};

const ORB_SIZE = 24;
const ORB_OVERLAP = 9;

function TypingDots({ color = "#24ee89" }: { color?: string }) {
  return (
    <span className="inline-flex shrink-0 items-end gap-[3px]" aria-hidden>
      {[0, 0.12, 0.24].map((delay) => (
        <span
          key={delay}
          className="inline-block size-[4px] animate-bounce rounded-full [animation-duration:0.6s]"
          style={{ backgroundColor: color, animationDelay: `${delay}s` }}
        />
      ))}
    </span>
  );
}

function OverlappingAgentOrbs({ agents }: { agents: SubAgentState[] }) {
  const sorted = sortAgentsForOrbStack(agents);
  const width = ORB_SIZE + Math.max(0, sorted.length - 1) * (ORB_SIZE - ORB_OVERLAP);

  return (
    <div className="relative shrink-0" style={{ width, height: ORB_SIZE }}>
      {sorted.map((agent, index) => (
        <div
          key={agent.id}
          className="absolute top-0 rounded-full ring-2 ring-[#050508]"
          style={{
            left: index * (ORB_SIZE - ORB_OVERLAP),
            zIndex: index + 1,
          }}
        >
          <AgentOrb
            colorScheme={agent.color}
            active={agent.status === "running"}
            sizePx={ORB_SIZE}
          />
        </div>
      ))}
    </div>
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
  const highlight = SUBAGENT_HIGHLIGHT[agent.color] ?? "#24ee89";
  const trace = subAgentWidgetTrace(agent);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full min-w-0 items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
        "border-white/[0.08] bg-white/[0.03]",
        "hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/40",
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
        <div className="min-w-0 flex-1">
          <TraceShimmerText
            text={trace}
            active={isRunning}
            highlight={highlight}
            className={isFailed && !isRunning ? "text-red-400/90" : !isRunning ? "text-zinc-400" : undefined}
          />
        </div>
        {isRunning ? <TypingDots color={highlight} /> : null}
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
  const hasRunning = agents.some((a) => a.status === "running");
  const [expanded, setExpanded] = useState(hasRunning);

  useEffect(() => {
    if (hasRunning) setExpanded(true);
  }, [hasRunning]);

  const lead = useMemo(() => leadSubAgent(agents), [agents]);
  const leadTrace = subAgentWidgetTrace(lead);
  const leadHighlight = SUBAGENT_HIGHLIGHT[lead.color] ?? "#24ee89";
  const runningCount = agents.filter((a) => a.status === "running").length;
  const doneCount = agents.filter((a) => a.status === "done").length;

  if (agents.length === 0) return null;

  const statusLine =
    hasRunning
      ? `${runningCount} running`
      : `${doneCount}/${agents.length} done`;

  return (
    <div className="mb-2 w-full">
      <div
        className={cn(
          "overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.03]",
          hasRunning && "border-white/[0.12] bg-white/[0.04]",
        )}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "flex w-full min-w-0 items-center gap-2.5 px-2.5 py-2 text-left transition-colors",
            "hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/40",
          )}
          aria-expanded={expanded}
        >
          <OverlappingAgentOrbs agents={agents} />
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <div className="min-w-0 flex-1">
              <TraceShimmerText
                text={leadTrace}
                active={hasRunning}
                highlight={leadHighlight}
              />
            </div>
            {hasRunning ? <TypingDots color={leadHighlight} /> : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="text-[10px] font-medium text-zinc-500">{statusLine}</span>
            <ChevronDown
              className={cn(
                "size-3.5 shrink-0 text-zinc-500 transition-transform",
                expanded && "rotate-180",
              )}
              aria-hidden
            />
          </div>
        </button>

        {expanded ? (
          <div className="space-y-1 border-t border-white/[0.06] p-1.5">
            {agents.map((agent) => (
              <SubAgentWidget
                key={agent.id}
                agent={agent}
                onClick={onOpenAgent ? () => onOpenAgent(agent) : undefined}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
