"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ORCHESTRATOR_HIGHLIGHT } from "@/components/ai-elements/agent-visual-constants";

/** Simple loading spinner for tools, sub-agents, and live trace. */
export function ActivitySpinner({
  color = ORCHESTRATOR_HIGHLIGHT,
  className,
  sizeClassName = "size-3",
}: {
  color?: string;
  className?: string;
  sizeClassName?: string;
}) {
  return (
    <Loader2
      className={cn("shrink-0 animate-spin", sizeClassName, className)}
      style={{ color }}
      aria-hidden
    />
  );
}
