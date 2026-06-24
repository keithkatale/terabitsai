"use client";

import { cn } from "@/lib/utils";
import type { SubAgentColorScheme } from "@/lib/chat/subagent-types";
import PixelBlast from "./pixel-blast.jsx";

export type AgentPixelColorScheme = "green" | SubAgentColorScheme;

const PIXEL_COLORS: Record<AgentPixelColorScheme, string> = {
  green: "#24ee89",
  cyan: "#22d3ee",
  blue: "#60a5fa",
  violet: "#a78bfa",
  amber: "#fbbf24",
  rose: "#fb7185",
  emerald: "#34d399",
};

export function AgentPixelAvatar({
  colorScheme = "green",
  active = false,
  sizePx = 28,
  className,
}: {
  colorScheme?: AgentPixelColorScheme;
  active?: boolean;
  sizePx?: number;
  className?: string;
}) {
  const color = PIXEL_COLORS[colorScheme] ?? PIXEL_COLORS.green;
  // Square cells — larger blocks read clearly at avatar sizes (28–40px).
  const pixelSize = sizePx <= 24 ? 3 : sizePx <= 32 ? 4 : 5;

  return (
    <div
      className={cn("relative shrink-0 overflow-hidden rounded-full ring-1 ring-white/10", className)}
      style={{ width: sizePx, height: sizePx, minWidth: sizePx, minHeight: sizePx }}
      role="img"
      aria-label={active ? "Agent is working" : "Agent"}
    >
      <PixelBlast
        variant="square"
        pixelSize={pixelSize}
        color={color}
        patternScale={2.4}
        patternDensity={1.9}
        pixelSizeJitter={0.2}
        enableRipples={false}
        liquid={false}
        speed={active ? 7.8 : 0}
        edgeFade={0}
        transparent
        autoPauseOffscreen={false}
      />
    </div>
  );
}

/** Orchestrator avatar — green pixel orb. */
export function AssistantPixelAvatar({
  active = false,
  sizePx = 28,
  className,
}: {
  active?: boolean;
  sizePx?: number;
  className?: string;
}) {
  return (
    <AgentPixelAvatar
      colorScheme="green"
      active={active}
      sizePx={sizePx}
      className={className}
    />
  );
}
