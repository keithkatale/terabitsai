"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

const SEGMENT_COLORS = ["#7209B3", "#00C5C9", "#F72585", "#FFD600", "#3A86FF", "#8338EC"];

export type AllocationSegment = {
  label: string;
  value: number;
  color?: string;
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export function PortfolioAllocationDonut({
  segments,
  centerLabel,
  className,
  size = 120,
}: {
  segments: AllocationSegment[];
  centerLabel: string;
  className?: string;
  size?: number;
}) {
  const stroke = Math.max(16, Math.round(size * 0.17));
  const innerR = size / 2 - stroke / 2 - 2;
  const total = useMemo(
    () => segments.reduce((sum, s) => sum + Math.max(0, s.value), 0),
    [segments],
  );

  const arcs = useMemo(() => {
    if (total <= 0) return [];
    let cursor = 0;
    return segments
      .filter((s) => s.value > 0)
      .map((segment, index) => {
        const sweep = (segment.value / total) * 360;
        const start = cursor;
        const end = cursor + sweep;
        cursor = end;
        return {
          ...segment,
          d: describeArc(size / 2, size / 2, innerR, start, end - 0.5),
          color: segment.color ?? SEGMENT_COLORS[index % SEGMENT_COLORS.length],
        };
      });
  }, [segments, total, size]);

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={innerR}
          fill="none"
          stroke="#151A20"
          strokeWidth={stroke}
        />
        {arcs.map((arc) => (
          <path
            key={arc.label}
            d={arc.d}
            fill="none"
            stroke={arc.color}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span
          className="font-bold leading-none text-white"
          style={{ fontSize: Math.round(size * 0.17) }}
        >
          {centerLabel}
        </span>
      </div>
    </div>
  );
}

export function AllocationLegend({
  segments,
  className,
}: {
  segments: AllocationSegment[];
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);

  return (
    <ul className={cn("space-y-1", className)}>
      {segments.map((segment, index) => {
        const pct = total > 0 ? (segment.value / total) * 100 : 0;
        const color = segment.color ?? SEGMENT_COLORS[index % SEGMENT_COLORS.length];
        return (
          <li key={segment.label} className="flex items-center gap-2">
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="min-w-0 flex-1 truncate text-xs text-white">{segment.label}</span>
            <span className="shrink-0 text-[10px] tabular-nums text-zinc-400">
              {pct.toFixed(0)}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}
