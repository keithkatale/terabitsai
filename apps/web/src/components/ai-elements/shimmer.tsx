"use client";

import { cn } from "@/lib/utils";
import { TRACE_SHIMMER_DURATION_S } from "@/components/ai-elements/agent-visual-constants";

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
  highlight = "#24ee89",
}: ShimmerProps) {
  if (!children.trim()) return null;

  return (
    <Tag
      className={cn(
        "block min-w-0 max-w-full truncate bg-clip-text font-medium text-transparent",
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

/** Live trace line with optional shimmer — shared by orchestrator, tools, sub-agents. */
export function TraceShimmerText({
  text,
  active,
  highlight = "#24ee89",
  className,
}: {
  text: string;
  active: boolean;
  highlight?: string;
  className?: string;
}) {
  if (!text.trim()) return null;

  if (active) {
    return (
      <Shimmer className={cn("text-[11px] leading-snug", className)} highlight={highlight}>
        {text}
      </Shimmer>
    );
  }

  return (
    <span
      className={cn(
        "block min-w-0 truncate text-[11px] font-medium leading-snug text-zinc-400",
        className,
      )}
    >
      {text}
    </span>
  );
}
