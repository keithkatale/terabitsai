"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import type { ChartDrawing } from "@/lib/chart/chart-drawings";
import { DRAWING_COLORS } from "@/lib/chart/chart-drawings";

export type ChartPlotMetrics = {
  width: number;
  height: number;
  padLeft: number;
  padRight: number;
  padTop: number;
  plotBottomY: number;
  t0: number;
  t1: number;
  yMin: number;
  yMax: number;
};

function priceToY(price: number, plot: ChartPlotMetrics): number {
  const innerH = plot.plotBottomY - plot.padTop;
  const frac = (price - plot.yMin) / Math.max(plot.yMax - plot.yMin, 1e-9);
  return plot.padTop + innerH * (1 - frac);
}

function timeToX(time: number, plot: ChartPlotMetrics): number {
  const innerW = plot.width - plot.padLeft - plot.padRight;
  const spanT = Math.max(plot.t1 - plot.t0, 1);
  const nx = (time - plot.t0) / spanT;
  return plot.padLeft + nx * innerW;
}

function colorForDrawing(d: ChartDrawing): string {
  if (d.type === "marker") {
    return d.side === "buy" ? DRAWING_COLORS.entry : DRAWING_COLORS.stop;
  }
  const key = d.color ?? "pivot";
  return DRAWING_COLORS[key] ?? DRAWING_COLORS.pivot;
}

function HLineDrawing({
  drawing,
  plot,
  index,
}: {
  drawing: Extract<ChartDrawing, { type: "hline" }>;
  plot: ChartPlotMetrics;
  index: number;
}) {
  const y = priceToY(drawing.price, plot);
  const color = colorForDrawing(drawing);
  const x1 = plot.padLeft;
  const x2 = plot.width - plot.padRight;
  const lineLen = x2 - x1;

  return (
    <g className="chart-drawing chart-drawing-hline" style={{ animationDelay: `${index * 80}ms` }}>
      <line
        x1={x1}
        y1={y}
        x2={x2}
        y2={y}
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray={lineLen}
        strokeDashoffset={lineLen}
        className="chart-draw-animate-line"
        opacity={0.85}
      />
      {drawing.label ? (
        <text
          x={x2 - 4}
          y={y - 4}
          textAnchor="end"
          fill={color}
          fontSize={10}
          fontWeight={600}
          className="chart-draw-animate-fade"
        >
          {drawing.label} · {formatPrice(drawing.price)}
        </text>
      ) : null}
    </g>
  );
}

function ZoneDrawing({
  drawing,
  plot,
  index,
}: {
  drawing: Extract<ChartDrawing, { type: "zone" }>;
  plot: ChartPlotMetrics;
  index: number;
}) {
  const top = Math.min(drawing.priceTop, drawing.priceBottom);
  const bottom = Math.max(drawing.priceTop, drawing.priceBottom);
  const yTop = priceToY(top, plot);
  const yBottom = priceToY(bottom, plot);
  const color = colorForDrawing(drawing);
  const x = plot.padLeft;
  const w = plot.width - plot.padLeft - plot.padRight;

  return (
    <g className="chart-drawing chart-drawing-zone" style={{ animationDelay: `${index * 80}ms` }}>
      <rect
        x={x}
        y={yTop}
        width={w}
        height={Math.max(yBottom - yTop, 2)}
        fill={color}
        fillOpacity={0.12}
        stroke={color}
        strokeWidth={1}
        strokeOpacity={0.4}
        className="chart-draw-animate-fade"
      />
      {drawing.label ? (
        <text
          x={x + 6}
          y={yTop + 12}
          fill={color}
          fontSize={10}
          fontWeight={600}
          className="chart-draw-animate-fade"
        >
          {drawing.label}
        </text>
      ) : null}
    </g>
  );
}

function TrendlineDrawing({
  drawing,
  plot,
  index,
}: {
  drawing: Extract<ChartDrawing, { type: "trendline" }>;
  plot: ChartPlotMetrics;
  index: number;
}) {
  const x1 = timeToX(drawing.t1, plot);
  const y1 = priceToY(drawing.p1, plot);
  const x2 = timeToX(drawing.t2, plot);
  const y2 = priceToY(drawing.p2, plot);
  const color = colorForDrawing(drawing);
  const lineLen = Math.hypot(x2 - x1, y2 - y1);

  return (
    <g className="chart-drawing chart-drawing-trendline" style={{ animationDelay: `${index * 80}ms` }}>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray={lineLen}
        strokeDashoffset={lineLen}
        className="chart-draw-animate-line"
      />
      {drawing.label ? (
        <text x={x2 + 4} y={y2 - 4} fill={color} fontSize={10} fontWeight={600} className="chart-draw-animate-fade">
          {drawing.label}
        </text>
      ) : null}
    </g>
  );
}

function MarkerDrawing({
  drawing,
  plot,
  index,
}: {
  drawing: Extract<ChartDrawing, { type: "marker" }>;
  plot: ChartPlotMetrics;
  index: number;
}) {
  const x = timeToX(drawing.time, plot);
  const y = priceToY(drawing.price, plot);
  const color = colorForDrawing(drawing);

  return (
    <g className="chart-drawing chart-drawing-marker" style={{ animationDelay: `${index * 80}ms` }}>
      <circle cx={x} cy={y} r={5} fill={color} className="chart-draw-animate-fade" />
      <text
        x={x + 8}
        y={y + 4}
        fill={color}
        fontSize={10}
        fontWeight={700}
        className="chart-draw-animate-fade"
      >
        {drawing.label}
      </text>
    </g>
  );
}

function formatPrice(value: number): string {
  if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (value >= 1) return value.toFixed(2);
  return value.toFixed(4);
}

export function ChartAnnotationLayer({
  drawings,
  plot,
  visible = true,
  className,
}: {
  drawings: ChartDrawing[];
  plot: ChartPlotMetrics | null;
  visible?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");

  if (!plot || !visible || drawings.length === 0) return null;

  return (
    <svg
      className={cn("pointer-events-none absolute inset-0", className)}
      width={plot.width}
      height={plot.height}
      aria-hidden
    >
      <style>{`
        .chart-draw-animate-line {
          animation: chart-draw-line 0.6s ease-out forwards;
        }
        .chart-draw-animate-fade {
          opacity: 0;
          animation: chart-draw-fade 0.5s ease-out forwards;
        }
        @keyframes chart-draw-line {
          to { stroke-dashoffset: 0; }
        }
        @keyframes chart-draw-fade {
          to { opacity: 1; }
        }
      `}</style>
      <defs>
        <clipPath id={`chart-clip-${uid}`}>
          <rect
            x={plot.padLeft}
            y={plot.padTop}
            width={plot.width - plot.padLeft - plot.padRight}
            height={plot.plotBottomY - plot.padTop}
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#chart-clip-${uid})`}>
        {drawings.map((d, i) => {
          if (d.type === "hline") return <HLineDrawing key={i} drawing={d} plot={plot} index={i} />;
          if (d.type === "zone") return <ZoneDrawing key={i} drawing={d} plot={plot} index={i} />;
          if (d.type === "trendline") return <TrendlineDrawing key={i} drawing={d} plot={plot} index={i} />;
          if (d.type === "marker") return <MarkerDrawing key={i} drawing={d} plot={plot} index={i} />;
          return null;
        })}
      </g>
    </svg>
  );
}

export { priceToY, timeToX };
