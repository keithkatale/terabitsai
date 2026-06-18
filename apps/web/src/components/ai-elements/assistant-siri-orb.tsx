"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export function AssistantSiriOrb({
  active = false,
  sizePx = 40,
  className
}: {
  /** Faster swirl while the assistant is streaming a reply. */
  active?: boolean;
  sizePx?: number;
  className?: string;
}) {
  const animationDurationSec = active ? 8 : 22;
  /* Slightly less blur than before so hues stay visible on light backgrounds */
  const blurAmount = Math.max(sizePx * 0.065, 4);
  const contrastAmount = Math.max(sizePx * 0.0035, 2.05);

  const style = {
    width: sizePx,
    height: sizePx,
    "--assistant-siri-duration": `${animationDurationSec}s`,
    "--assistant-siri-blur": `${blurAmount}px`,
    "--assistant-siri-contrast": contrastAmount
  } as CSSProperties;

  return (
    <div
      className={cn(
        "assistant-siri-orb ring-1 ring-white/10",
        className
      )}
      style={style}
      role="img"
      aria-label={active ? "Assistant is responding" : "Assistant"}
    />
  );
}
