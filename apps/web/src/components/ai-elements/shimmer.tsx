"use client";

import { cn } from "@/lib/utils";
import { TRACE_SHIMMER_DURATION_S, ORCHESTRATOR_HIGHLIGHT } from "@/components/ai-elements/agent-visual-constants";

type ShimmerProps = {
  children: string;
  as?: "span" | "p";
  className?: string;
  duration?: number;
  highlight?: string;
};

/** Animated text shimmer — duration synced to PixelBlast active speed. */
export function Shimmer({
  children,
  as: Tag = "span",
  className,
  duration = TRACE_SHIMMER_DURATION_S,
  highlight = ORCHESTRATOR_HIGHLIGHT,
}: ShimmerProps) {
  if (!children.trim()) return null;

  return (
    <Tag
      className={cn(
        "inline-block max-w-full truncate bg-clip-text font-medium text-transparent",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(90deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.5) 15%, ${highlight} 40%, ${highlight} 60%, rgba(255,255,255,0.5) 85%, rgba(255,255,255,0.4) 100%)`,
        backgroundSize: "200% auto",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        animation: `traceTextShimmer ${duration}s ease-in-out infinite`,
      }}
    >
      {children}
    </Tag>
  );
}

/** Live trace line — shimmer for orchestrator, plain text for tools/sub-agents. */
export function TraceShimmerText({
  text,
  active,
  highlight = ORCHESTRATOR_HIGHLIGHT,
  className,
  loadingStyle = "shimmer",
}: {
  text: string;
  active: boolean;
  highlight?: string;
  className?: string;
  /** `static` = no text animation while running (tools / sub-agents). */
  loadingStyle?: "shimmer" | "static";
}) {
  if (!text.trim()) return null;

  if (active && loadingStyle === "shimmer") {
    return (
      <Shimmer className={cn("text-[11px] leading-snug", className)} highlight={highlight}>
        {text}
      </Shimmer>
    );
  }

  if (active) {
    return (
      <span
        className={cn(
          "inline-block max-w-full truncate text-[11px] font-medium leading-snug",
          className,
        )}
        style={{ color: highlight }}
      >
        {text}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-block max-w-full truncate text-[11px] font-medium leading-snug text-zinc-400",
        className,
      )}
    >
      {text}
    </span>
  );
}
