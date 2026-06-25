"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatToolPod } from "@/lib/chat/stream-types";
import {
  annotateStreamingSteps,
  buildActivityTimeline,
  buildLegacyActivityTimeline,
  finalizeActivitySteps,
  type ActivityPartRef,
  type ActivityStep,
  type ReasoningActivityStep,
  type ToolActivityStep,
} from "@/lib/chat/activity-timeline";
import { deriveLiveTraceFromSteps, LIVE_TRACE_PLANNING, shortenLivePhrase } from "@/lib/chat/live-trace";
import { TraceShimmerText } from "@/components/ai-elements/shimmer";
import { ToolStepWidget } from "@/components/ai-elements/tool-step-widget";
import { ThinkingMarkdown } from "@/components/ai-elements/thinking-markdown";

function TypingDots() {
  return (
    <span className="inline-flex shrink-0 items-end gap-[3px]" aria-hidden>
      <span className="inline-block size-[5px] animate-bounce rounded-full bg-[#24ee89] [animation-duration:0.6s]" />
      <span className="inline-block size-[5px] animate-bounce rounded-full bg-[#24ee89] [animation-duration:0.6s] [animation-delay:0.12s]" />
      <span className="inline-block size-[5px] animate-bounce rounded-full bg-[#24ee89] [animation-duration:0.6s] [animation-delay:0.24s]" />
    </span>
  );
}

function LiveTraceLine({
  label,
  showDots,
  liveStatusDetail,
  compact,
  shimmer = false,
  highlight = "#24ee89",
}: {
  label: string;
  showDots: boolean;
  liveStatusDetail?: string;
  accentClassName?: string;
  compact?: boolean;
  shimmer?: boolean;
  highlight?: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 py-0.5">
      <div className="min-w-0 flex-1">
        <TraceShimmerText
          text={label}
          active={shimmer}
          highlight={highlight}
          className={compact ? "text-[11px]" : "text-[12.5px]"}
        />
      </div>
      {liveStatusDetail ? (
        <span className="shrink-0 text-[11px] font-normal text-zinc-400">· {liveStatusDetail}</span>
      ) : null}
      {showDots ? <TypingDots /> : null}
    </div>
  );
}

function ReasoningStepRow({
  step,
  isLive,
}: {
  step: ReasoningActivityStep;
  isLive: boolean;
}) {
  const preview = shortenLivePhrase(step.text) ?? "Thinking";

  if (!isLive) {
    return (
      <div className="py-0.5 text-[10px] text-zinc-600">
        <span className="text-zinc-500">Thought</span>
        <span className="mx-1.5 text-zinc-700">·</span>
        <span className="text-zinc-500">{preview}</span>
      </div>
    );
  }

  return (
    <div className="py-0.5">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">Thinking</p>
      <ThinkingMarkdown markdown={step.text} className="max-h-48" />
    </div>
  );
}


function ActivityTimelineBody({
  steps,
  isStreaming,
}: {
  steps: ActivityStep[];
  isStreaming: boolean;
}) {
  if (!isStreaming || steps.length === 0) return null;

  return (
    <div className="ml-0.5 mt-1 space-y-1.5 border-l border-white/[0.08] pl-3">
      {steps.map((step) => {
        // Skip update steps — they're displayed separately
        if (step.type === "update") {
          return null;
        }
        if (step.type === "reasoning") {
          return (
            <ReasoningStepRow
              key={step.id}
              step={step}
              isLive={step.status === "streaming"}
            />
          );
        }
        if (step.type === "tool") {
          return (
            <ToolStepWidget
              key={step.toolUseId}
              pod={step}
              active={step.status === "running"}
              compact
            />
          );
        }
        return null;
      })}
    </div>
  );
}

function DoneTimelineSummary({ steps }: { steps: ActivityStep[] }) {
  return (
    <div className="ml-0.5 mt-1 space-y-1.5 border-l border-white/[0.08] pl-3">
      {steps.map((step) => {
        // Skip update steps — they're displayed separately
        if (step.type === "update") {
          return null;
        }
        if (step.type === "reasoning") {
          return (
            <div key={step.id} className="space-y-1">
              <p className="text-[10px] font-medium text-zinc-500">Thought</p>
              <ThinkingMarkdown markdown={step.text} className="max-h-32" />
            </div>
          );
        }
        if (step.type === "tool") {
          return <ToolStepWidget key={step.toolUseId} pod={step} compact />;
        }
        return null;
      })}
    </div>
  );
}

function resolveTimeline(
  activityParts: ActivityPartRef[] | undefined,
  activitySteps: ActivityStep[] | undefined,
  reasoning: string,
  toolPods: ChatToolPod[],
  isStreaming: boolean,
): ActivityStep[] {
  if (activitySteps && activitySteps.length > 0) {
    return isStreaming ? annotateStreamingSteps(activitySteps) : finalizeActivitySteps(activitySteps);
  }
  if (activityParts && activityParts.length > 0) {
    return buildActivityTimeline(activityParts, toolPods, isStreaming);
  }
  if (reasoning.trim() || toolPods.length > 0) {
    return buildLegacyActivityTimeline(reasoning, toolPods, isStreaming);
  }
  return [];
}

/** Always-visible live trace — used under sub-agent widgets while running. */
export function AgentLiveTrace({
  reasoning,
  toolPods,
  liveStatus,
  liveStatusDetail,
  accentClassName = "text-[#24ee89]",
  compact = false,
  labelOnly = false,
  activityParts,
  activitySteps,
  highlight = "#24ee89",
}: {
  reasoning: string;
  toolPods: ChatToolPod[];
  liveStatus?: string;
  liveStatusDetail?: string;
  accentClassName?: string;
  compact?: boolean;
  labelOnly?: boolean;
  activityParts?: ActivityPartRef[];
  activitySteps?: ActivityStep[];
  highlight?: string;
}) {
  const steps = resolveTimeline(activityParts, activitySteps, reasoning, toolPods, true);
  const label =
    liveStatus?.trim() || deriveLiveTraceFromSteps(steps, LIVE_TRACE_PLANNING);

  return (
    <div className="w-full" role="status" aria-live="polite">
        <LiveTraceLine
          label={label}
          showDots
          shimmer
          highlight={highlight}
          liveStatusDetail={liveStatusDetail}
          compact={compact}
        />
      {!labelOnly ? <ActivityTimelineBody steps={steps} isStreaming /> : null}
    </div>
  );
}

/** Orchestrator-style activity trace — sequential tools + reasoning. */
export function AgentActivity({
  reasoning,
  toolPods,
  isStreaming,
  liveStatus,
  liveStatusDetail,
  accentClassName = "text-[#24ee89]",
  collapsed = false,
  activityParts,
  activitySteps,
}: {
  reasoning: string;
  toolPods: ChatToolPod[];
  isStreaming: boolean;
  liveStatus?: string;
  liveStatusDetail?: string;
  accentClassName?: string;
  collapsed?: boolean;
  activityParts?: ActivityPartRef[];
  activitySteps?: ActivityStep[];
}) {
  const steps = resolveTimeline(activityParts, activitySteps, reasoning, toolPods, isStreaming);
  const label =
    liveStatus?.trim() || deriveLiveTraceFromSteps(steps, LIVE_TRACE_PLANNING);

  if (isStreaming) {
    if (collapsed) {
      return (
        <AgentLiveTrace
          reasoning={reasoning}
          toolPods={toolPods}
          liveStatus={label}
          liveStatusDetail={liveStatusDetail}
          accentClassName={accentClassName}
          labelOnly
          activityParts={activityParts}
          activitySteps={activitySteps}
        />
      );
    }

    return (
      <div className="mb-2 w-full max-w-full" role="status" aria-live="polite">
        <LiveTraceLine
          label={label}
          showDots
          shimmer={isStreaming}
          highlight="#24ee89"
          liveStatusDetail={liveStatusDetail}
        />
        <ActivityTimelineBody steps={steps} isStreaming />
      </div>
    );
  }

  if (steps.length === 0) return null;

  return (
    <details key="done" className="group/trace mb-2 w-full max-w-full">
      <summary className="cursor-pointer list-none select-none py-1 text-[11px] font-medium text-zinc-500 marker:hidden transition-colors hover:text-zinc-300 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1.5">
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-55 transition-transform group-open/trace:rotate-180" aria-hidden />
          How this reply was built
        </span>
      </summary>
      <DoneTimelineSummary steps={steps} />
    </details>
  );
}
