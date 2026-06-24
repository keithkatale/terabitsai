"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatToolPod } from "@/lib/chat/stream-types";
import {
  annotateStreamingSteps,
  buildActivityTimeline,
  buildLegacyActivityTimeline,
  finalizeActivitySteps,
  getActiveActivityStep,
  type ActivityPartRef,
  type ActivityStep,
  type ReasoningActivityStep,
  type ToolActivityStep,
} from "@/lib/chat/activity-timeline";
import { deriveLiveTraceFromSteps, LIVE_TRACE_PLANNING, shortenLivePhrase } from "@/lib/chat/live-trace";
import { ToolPodRow } from "@/components/ai-elements/tool-pod-row";
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
  accentClassName,
  compact,
}: {
  label: string;
  showDots: boolean;
  liveStatusDetail?: string;
  accentClassName?: string;
  compact?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 py-0.5">
      <span
        className={cn(
          "min-w-0 truncate font-medium text-shimmer",
          compact ? "text-[11px]" : "text-[12.5px]",
          accentClassName,
        )}
      >
        {label}
        {liveStatusDetail ? (
          <span className="ml-1.5 font-normal text-zinc-400">· {liveStatusDetail}</span>
        ) : null}
      </span>
      {showDots ? <TypingDots /> : null}
    </div>
  );
}

function ReasoningStepRow({
  step,
  isActive,
}: {
  step: ReasoningActivityStep;
  isActive: boolean;
}) {
  const preview = shortenLivePhrase(step.text) ?? "Thinking";

  if (!isActive) {
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
      <ThinkingMarkdown markdown={step.text} />
    </div>
  );
}

function ToolStepRow({ step, isActive }: { step: ToolActivityStep; isActive: boolean }) {
  const label = step.name.replace(/_/g, " ");

  if (!isActive) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-0.5 text-[10px]">
        <span className="font-mono uppercase tracking-tight text-zinc-500">{label}</span>
        <span className={step.ok === false ? "text-red-400/80" : "text-zinc-600"}>
          {step.ok === false ? "Failed" : "Done"}
        </span>
        {step.durationMs != null ? (
          <span className="text-zinc-700">{step.durationMs}ms</span>
        ) : null}
      </div>
    );
  }

  return <ToolPodRow pod={step} defaultOpen />;
}

function ActivityTimelineBody({
  steps,
  isStreaming,
  activeStep,
}: {
  steps: ActivityStep[];
  isStreaming: boolean;
  activeStep: ActivityStep | null;
}) {
  if (!activeStep || steps.length === 0) return null;

  return (
    <div className="ml-0.5 mt-1 space-y-1 border-l border-white/[0.08] pl-3">
      {steps.map((step) => {
        const isActive = step === activeStep;
        if (step.type === "reasoning") {
          return (
            <ReasoningStepRow
              key={step.id}
              step={step}
              isActive={isActive && step.status === "streaming"}
            />
          );
        }
        return (
          <ToolStepRow
            key={step.toolUseId}
            step={step}
            isActive={isActive && step.status === "running"}
          />
        );
      })}
    </div>
  );
}

function DoneTimelineSummary({ steps }: { steps: ActivityStep[] }) {
  return (
    <div className="ml-0.5 mt-1 space-y-1.5 border-l border-white/[0.08] pl-3">
      {steps.map((step) => {
        if (step.type === "reasoning") {
          return (
            <div key={step.id} className="space-y-1">
              <p className="text-[10px] font-medium text-zinc-500">Thought</p>
              <ThinkingMarkdown markdown={step.text} className="max-h-32" />
            </div>
          );
        }
        return <ToolPodRow key={step.toolUseId} pod={step} />;
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
  const hasOrderedParts = activityParts?.some((p) => p.type === "tool_ref");
  if (hasOrderedParts && activityParts) {
    return buildActivityTimeline(activityParts, toolPods, isStreaming);
  }
  if (reasoning.trim() || toolPods.length > 0) {
    return buildLegacyActivityTimeline(reasoning, toolPods);
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
}) {
  const steps = resolveTimeline(activityParts, activitySteps, reasoning, toolPods, true);
  const label =
    liveStatus?.trim() || deriveLiveTraceFromSteps(steps, LIVE_TRACE_PLANNING);
  const activeStep = getActiveActivityStep(steps);

  return (
    <div className="w-full" role="status" aria-live="polite">
      <LiveTraceLine
        label={label}
        showDots
        liveStatusDetail={liveStatusDetail}
        accentClassName={accentClassName}
        compact={compact}
      />
      {!labelOnly && activeStep ? (
        <ActivityTimelineBody steps={steps} isStreaming activeStep={activeStep} />
      ) : null}
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
  const activeStep = isStreaming ? getActiveActivityStep(steps) : null;
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
          liveStatusDetail={liveStatusDetail}
          accentClassName={accentClassName}
        />
        {activeStep ? (
          <ActivityTimelineBody
            steps={steps}
            isStreaming
            activeStep={activeStep}
          />
        ) : null}
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
