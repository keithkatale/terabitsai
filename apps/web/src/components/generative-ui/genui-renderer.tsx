"use client";

import * as React from "react";
import * as LucideIcons from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { GenerativeUiRegistry } from "./registry";
import { useChatWidgetAction } from "@/contexts/chat-widget-context";
import type { WidgetAction } from "@/lib/chat/widget-actions";
import {
  type GenUiAccent,
  type GenUiNode,
  type GenUiTrend,
  normalizeGenUiPayload,
} from "./genui-types";
import { GenUiErrorBoundary } from "./genui-error-boundary";

/* ──────────────────────────────────────────────────────────────────────────
 * Branded accent palette
 * ────────────────────────────────────────────────────────────────────────── */

interface AccentTokens {
  text: string;
  soft: string; // translucent fill
  border: string;
  hex: string; // raw colour for SVG strokes/gradients
}

const ACCENTS: Record<GenUiAccent, AccentTokens> = {
  cyan: { text: "text-cyan-300", soft: "bg-cyan-500/10", border: "border-cyan-500/20", hex: "#38bdf8" },
  violet: { text: "text-violet-300", soft: "bg-violet-500/10", border: "border-violet-500/20", hex: "#a78bfa" },
  emerald: { text: "text-emerald-300", soft: "bg-emerald-500/10", border: "border-emerald-500/20", hex: "#34d399" },
  rose: { text: "text-rose-300", soft: "bg-rose-500/10", border: "border-rose-500/20", hex: "#f87171" },
  amber: { text: "text-amber-300", soft: "bg-amber-500/10", border: "border-amber-500/20", hex: "#fbbf24" },
  sky: { text: "text-sky-300", soft: "bg-sky-500/10", border: "border-sky-500/20", hex: "#7dd3fc" },
  zinc: { text: "text-zinc-300", soft: "bg-zinc-500/10", border: "border-zinc-700/30", hex: "#a1a1aa" },
};

function accent(name?: GenUiAccent): AccentTokens {
  return ACCENTS[name ?? "cyan"] ?? ACCENTS.cyan;
}

const SERIES_PALETTE = ["#38bdf8", "#a78bfa", "#34d399", "#fbbf24", "#f87171", "#7dd3fc"];

function resolveColor(c: string | undefined, idx: number): string {
  if (!c) return SERIES_PALETTE[idx % SERIES_PALETTE.length];
  if (c.startsWith("#")) return c;
  const tok = ACCENTS[c as GenUiAccent];
  return tok ? tok.hex : SERIES_PALETTE[idx % SERIES_PALETTE.length];
}

/* ──────────────────────────────────────────────────────────────────────────
 * Small helpers
 * ────────────────────────────────────────────────────────────────────────── */

function formatValue(v: string | number): string {
  if (typeof v === "number") {
    if (Math.abs(v) >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
    return String(v);
  }
  return v;
}

type IconComp = React.ComponentType<{ className?: string }>;
const ICONS = LucideIcons as unknown as Record<string, IconComp>;

function resolveIcon(name?: string): IconComp | null {
  if (!name) return null;
  const pascal = name.replace(/(^\w|[-_\s]\w)/g, (m) => m.replace(/[-_\s]/, "").toUpperCase());
  return ICONS[pascal] ?? null;
}

/** Pick the first icon name that actually exists in the installed lucide version. */
function pickIcon(...names: string[]): IconComp {
  for (const n of names) {
    if (ICONS[n]) return ICONS[n];
  }
  return ICONS.Info ?? Minus;
}

function TrendBadge({ trend, delta }: { trend?: GenUiTrend; delta?: string | number }) {
  if (delta === undefined && !trend) return null;
  const dir: GenUiTrend = trend ?? (typeof delta === "number" ? (delta >= 0 ? "up" : "down") : "flat");
  const cls =
    dir === "up" ? "text-emerald-400 bg-emerald-500/10" : dir === "down" ? "text-rose-400 bg-rose-500/10" : "text-zinc-400 bg-zinc-500/10";
  const Icon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold", cls)}>
      <Icon className="size-3" />
      {delta !== undefined ? formatValue(delta) : null}
    </span>
  );
}

/** Subtle count-up for numeric values — part of the "expressive" feel. */
function useCountUp(target: number, enabled: boolean): number {
  const [val, setVal] = React.useState(enabled ? 0 : target);
  React.useEffect(() => {
    if (!enabled) {
      setVal(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const dur = 700;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);
  return val;
}

function AnimatedNumber({ value }: { value: string | number }) {
  const isNum = typeof value === "number" && Number.isFinite(value);
  const animated = useCountUp(isNum ? (value as number) : 0, isNum);
  if (!isNum) return <>{value}</>;
  const decimals = !Number.isInteger(value) ? 2 : 0;
  return <>{animated.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}</>;
}

/* ──────────────────────────────────────────────────────────────────────────
 * SVG primitives
 * ────────────────────────────────────────────────────────────────────────── */

function buildLinePath(data: number[], w: number, h: number, pad = 2) {
  if (data.length === 0) return { line: "", area: "" };
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / Math.max(1, data.length - 1);
  const pts = data.map((d, i) => {
    const x = pad + i * stepX;
    const y = pad + (h - pad * 2) * (1 - (d - min) / range);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(2)},${h} L${pts[0][0].toFixed(2)},${h} Z`;
  return { line, area };
}

function Sparkline({ data, accent: a, label }: { data: number[]; accent?: GenUiAccent; label?: string }) {
  const tok = accent(a);
  const w = 120;
  const h = 36;
  const { line } = buildLinePath(data, w, h);
  const up = data.length >= 2 && data[data.length - 1] >= data[0];
  const stroke = a ? tok.hex : up ? ACCENTS.emerald.hex : ACCENTS.rose.hex;
  return (
    <div className="flex items-center gap-2">
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="overflow-visible">
        <path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="genui-draw" />
      </svg>
      {label ? <span className="text-[11px] text-zinc-500">{label}</span> : null}
    </div>
  );
}

function Gauge({ value, label, caption, accent: a }: { value: number; label?: string; caption?: string; accent?: GenUiAccent }) {
  const tok = accent(a);
  const v = Math.max(0, Math.min(100, value));
  const r = 52;
  const circ = Math.PI * r; // semicircle length
  const dash = (v / 100) * circ;
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4">
      <svg viewBox="0 0 140 80" width="140" height="80">
        <path d="M 18 72 A 52 52 0 0 1 122 72" fill="none" stroke="#27272a" strokeWidth={10} strokeLinecap="round" />
        <path
          d="M 18 72 A 52 52 0 0 1 122 72"
          fill="none"
          stroke={tok.hex}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.22,1,0.36,1)" }}
        />
        <text x="70" y="60" textAnchor="middle" className="fill-white" style={{ fontSize: 22, fontWeight: 700 }}>
          {Math.round(v)}
        </text>
      </svg>
      {label ? <span className="mt-1 text-xs font-semibold text-zinc-200">{label}</span> : null}
      {caption ? <span className="text-[11px] text-zinc-500">{caption}</span> : null}
    </div>
  );
}

function MiniChart({
  series,
  labels,
  variant = "area",
  height = 130,
  title,
}: {
  series: { name: string; data: number[]; color?: string }[];
  labels?: string[];
  variant?: "line" | "area";
  height?: number;
  title?: string;
}) {
  const w = 520;
  const h = height;
  const padBottom = labels && labels.length ? 22 : 6;
  const chartH = h - padBottom;
  const all = series.flatMap((s) => s.data);
  const min = all.length ? Math.min(...all) : 0;
  const max = all.length ? Math.max(...all) : 1;

  const scaled = series.map((s, i) => {
    const data = Array.isArray(s.data) ? s.data : [];
    const range = max - min || 1;
    const stepX = (w - 8) / Math.max(1, data.length - 1);
    const pts = data.map((d, j) => {
      const x = 4 + j * stepX;
      const y = 4 + (chartH - 8) * (1 - (d - min) / range);
      return [x, y] as const;
    });
    const line = pts.map(([x, y], j) => `${j === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
    const area =
      pts.length > 0
        ? `${line} L${pts[pts.length - 1][0].toFixed(2)},${chartH} L${pts[0][0].toFixed(2)},${chartH} Z`
        : "";
    return { line, area, color: resolveColor(s.color, i), name: s.name };
  });

  const gridLines = [0.25, 0.5, 0.75];

  return (
    <div className="w-full">
      {title ? <p className="mb-2 text-sm font-semibold text-zinc-100">{title}</p> : null}
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" preserveAspectRatio="none" style={{ display: "block" }}>
        <defs>
          {scaled.map((s, i) => (
            <linearGradient key={i} id={`genui-grad-${i}-${s.name.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        {gridLines.map((g, i) => (
          <line key={i} x1={0} x2={w} y1={4 + (chartH - 8) * g} y2={4 + (chartH - 8) * g} stroke="#ffffff" strokeOpacity={0.04} strokeWidth={1} />
        ))}
        {scaled.map((s, i) =>
          variant === "area" ? (
            <path key={`a-${i}`} d={s.area} fill={`url(#genui-grad-${i}-${s.name.replace(/\W/g, "")})`} stroke="none" />
          ) : null,
        )}
        {scaled.map((s, i) => (
          <path key={`l-${i}`} d={s.line} fill="none" stroke={s.color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="genui-draw" />
        ))}
        {labels && labels.length
          ? labels.map((lab, i) => {
              const x = 4 + (i * (w - 8)) / Math.max(1, labels.length - 1);
              return (
                <text key={i} x={x} y={h - 6} textAnchor="middle" className="fill-zinc-600" style={{ fontSize: 10 }}>
                  {lab}
                </text>
              );
            })
          : null}
      </svg>
      {series.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-3">
          {scaled.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
              <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Node renderer
 * ────────────────────────────────────────────────────────────────────────── */

function NodeView({
  node,
  animate,
  onWidgetAction,
}: {
  node: GenUiNode;
  animate: boolean;
  onWidgetAction?: (action: WidgetAction) => void;
}) {
  const fireAction = (action: WidgetAction) => {
    onWidgetAction?.(action);
  };

  switch (node.type) {
    case "section":
      return (
        <div className="w-full rounded-lg border border-zinc-800/50 bg-zinc-950/20 p-3">
          {node.title ? <h3 className="text-sm font-semibold text-white">{node.title}</h3> : null}
          {node.subtitle ? <p className="mb-2 mt-0.5 text-[11px] text-zinc-500">{node.subtitle}</p> : <div className="mb-2" />}
          <NodeList nodes={node.children} animate={animate} onWidgetAction={onWidgetAction} />
        </div>
      );

    case "grid": {
      const cols = Math.max(1, Math.min(4, node.columns ?? 2));
      const colClass =
        cols === 1 ? "grid-cols-1" : cols === 2 ? "grid-cols-1 sm:grid-cols-2" : cols === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4";
      return (
        <div className={cn("grid gap-2", colClass)}>
          {node.children.map((child, i) => (
            <NodeView key={i} node={child} animate={animate} onWidgetAction={onWidgetAction} />
          ))}
        </div>
      );
    }

    case "divider":
      return <div className="h-px w-full bg-zinc-800/70" />;

    case "text":
      return (
        <p
          className={cn(
            "text-[13.5px] leading-relaxed",
            node.tone === "muted" ? "text-zinc-500" : node.tone === "strong" ? "font-semibold text-white" : "text-zinc-300",
          )}
        >
          {node.text}
        </p>
      );

    case "stat": {
      const tok = accent(node.accent);
      const Icon = resolveIcon(node.icon);
      return (
        <div className={cn("flex items-center justify-between rounded-lg border bg-zinc-950/30 px-2.5 py-2", tok.border)}>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{node.label}</p>
            <p className={cn("mt-0.5 text-lg font-semibold", tok.text)}>
              <AnimatedNumber value={node.value} />
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {Icon ? (
              <span className={cn("rounded-lg p-1.5", tok.soft)}>
                <Icon className={cn("size-4", tok.text)} />
              </span>
            ) : null}
            <TrendBadge trend={node.trend} delta={node.delta} />
          </div>
        </div>
      );
    }

    case "metricCard": {
      const tok = accent(node.accent);
      return (
        <div className="flex flex-col justify-between rounded-lg border border-zinc-800/50 bg-zinc-950/30 p-2.5">
          <div className="flex items-start justify-between">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{node.label}</p>
            <TrendBadge trend={node.trend} delta={node.delta} />
          </div>
          <p className={cn("mt-0.5 text-lg font-semibold tracking-tight", tok.text)}>
            <AnimatedNumber value={node.value} />
          </p>
          {node.sublabel ? <p className="text-[11px] text-zinc-500">{node.sublabel}</p> : null}
          {node.sparkline && node.sparkline.length > 1 ? (
            <div className="mt-2">
              <Sparkline data={node.sparkline} accent={node.accent} />
            </div>
          ) : null}
        </div>
      );
    }

    case "sparkline":
      return (
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-3">
          <Sparkline data={node.data} accent={node.accent} label={node.label} />
        </div>
      );

    case "gauge":
      return <Gauge value={node.value} label={node.label} caption={node.caption} accent={node.accent} />;

    case "progress": {
      const tok = accent(node.accent);
      const v = Math.max(0, Math.min(100, node.value));
      return (
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-3.5">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-zinc-300">{node.label ?? "Progress"}</span>
            <span className={cn("font-semibold", tok.text)}>{Math.round(v)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800/80">
            <div
              className="h-full rounded-full"
              style={{ width: `${v}%`, backgroundColor: tok.hex, transition: "width 0.9s cubic-bezier(0.22,1,0.36,1)" }}
            />
          </div>
          {node.caption ? <p className="mt-1.5 text-[11px] text-zinc-500">{node.caption}</p> : null}
        </div>
      );
    }

    case "callout": {
      const variant = node.variant ?? "info";
      const map: Record<string, { wrap: string; icon: IconComp; iconCls: string }> = {
        info: { wrap: "border-sky-500/20 bg-sky-500/5", icon: pickIcon("Info"), iconCls: "text-sky-400" },
        success: { wrap: "border-emerald-500/20 bg-emerald-500/5", icon: pickIcon("CircleCheck", "CheckCircle2", "CheckCircle"), iconCls: "text-emerald-400" },
        warning: { wrap: "border-amber-500/20 bg-amber-500/5", icon: pickIcon("TriangleAlert", "AlertTriangle"), iconCls: "text-amber-400" },
        danger: { wrap: "border-rose-500/20 bg-rose-500/5", icon: pickIcon("OctagonAlert", "AlertOctagon", "TriangleAlert", "AlertTriangle"), iconCls: "text-rose-400" },
      };
      const m = map[variant] ?? map.info;
      const Icon = m.icon;
      return (
        <div className={cn("flex gap-3 rounded-xl border p-3.5", m.wrap)}>
          <Icon className={cn("mt-0.5 size-4 shrink-0", m.iconCls)} />
          <div>
            {node.title ? <p className="text-sm font-semibold text-zinc-100">{node.title}</p> : null}
            <p className="text-[13px] leading-relaxed text-zinc-300">{node.text}</p>
          </div>
        </div>
      );
    }

    case "badge": {
      const tok = accent(node.accent);
      return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", tok.soft, tok.border, tok.text)}>{node.text}</span>;
    }

    case "keyValue":
      return (
        <div className="divide-y divide-zinc-800/60 rounded-xl border border-zinc-800/60 bg-zinc-950/40">
          {node.items.map((it, i) => {
            const tok = accent(it.accent);
            return (
              <div key={i} className="flex items-center justify-between px-3.5 py-2.5">
                <span className="text-xs text-zinc-500">{it.label}</span>
                <span className={cn("text-sm font-semibold", it.accent ? tok.text : "text-zinc-100")}>{formatValue(it.value)}</span>
              </div>
            );
          })}
        </div>
      );

    case "barlist": {
      const max = node.max ?? Math.max(...node.items.map((i) => i.value), 1);
      return (
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4">
          {node.title ? <p className="mb-3 text-sm font-semibold text-zinc-100">{node.title}</p> : null}
          <div className="space-y-2.5">
            {node.items.map((it, i) => {
              const tok = accent(it.accent ?? (["cyan", "violet", "emerald", "amber", "rose", "sky"][i % 6] as GenUiAccent));
              const pct = Math.max(2, (it.value / max) * 100);
              return (
                <div key={i}>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">{it.label}</span>
                    <span className="font-semibold text-zinc-200">
                      {formatValue(it.value)}
                      {node.unit ?? ""}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800/70">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: tok.hex, transition: "width 0.9s cubic-bezier(0.22,1,0.36,1)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    case "table":
      return (
        <div className="overflow-x-auto rounded-xl border border-zinc-800/60">
          <table className="w-full border-collapse text-left text-xs text-zinc-300">
            <thead className="border-b border-zinc-800 bg-zinc-900/50 uppercase tracking-wider text-zinc-400">
              <tr>
                {node.columns.map((c, i) => (
                  <th key={i} className="px-3.5 py-2.5 font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {node.rows.map((row, ri) => (
                <tr key={ri} className="transition-colors hover:bg-zinc-900/30">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3.5 py-2.5">
                      {formatValue(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "chart":
      return (
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4">
          <MiniChart series={node.series} labels={node.labels} variant={node.variant} height={node.height} title={node.title} />
        </div>
      );

    case "component":
      return <GenerativeUiRegistry name={node.name} props={node.props ?? {}} />;

    case "actionButton": {
      const isPrimary = node.variant !== "secondary";
      return (
        <button
          type="button"
          onClick={() => {
            if (node.action === "prompt") {
              fireAction({ type: "prompt", prompt: node.payload });
            } else {
              fireAction({ type: "custom", action: node.payload, data: { label: node.label } });
            }
          }}
          className={cn(
            "inline-flex items-center justify-center rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-200 active:scale-[0.98]",
            isPrimary
              ? "border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 hover:text-white"
              : "border border-zinc-700/60 bg-zinc-900/40 text-zinc-300 hover:border-zinc-600 hover:text-white",
          )}
        >
          {node.label}
        </button>
      );
    }

    default:
      return (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-400">
          Unknown GenUI node: <code className="font-mono">{(node as { type?: string }).type ?? "?"}</code>
        </div>
      );
  }
}

function NodeList({
  nodes,
  animate,
  onWidgetAction,
}: {
  nodes: GenUiNode[];
  animate: boolean;
  onWidgetAction?: (action: WidgetAction) => void;
}) {
  return (
    <div className="space-y-3">
      {nodes.map((node, i) => (
        <div key={i} className={animate ? "genui-enter" : undefined} style={animate ? { animationDelay: `${Math.min(i * 70, 500)}ms` } : undefined}>
          <NodeView node={node} animate={animate} onWidgetAction={onWidgetAction} />
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Public entry — renders a parsed ```genui payload
 * ────────────────────────────────────────────────────────────────────────── */

export function GenUiRenderer({
  payload,
  onWidgetAction,
}: {
  payload: unknown;
  onWidgetAction?: (action: WidgetAction) => void;
}) {
  const nodes = React.useMemo(() => normalizeGenUiPayload(payload), [payload]);
  const [animate] = React.useState(true);
  const contextAction = useChatWidgetAction();
  const handleAction = React.useCallback(
    (action: WidgetAction) => {
      onWidgetAction?.(action);
      contextAction?.(action);
    },
    [contextAction, onWidgetAction],
  );

  if (!nodes || nodes.length === 0) {
    return (
      <div className="my-2 rounded-xl border border-rose-500/20 bg-rose-950/20 px-3.5 py-2.5 text-xs text-rose-400">
        Could not render generative UI — the payload had no recognizable nodes.
      </div>
    );
  }

  const rawPayload = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);

  return (
    <GenUiErrorBoundary fallbackTitle="Dashboard failed to render" rawPayload={rawPayload}>
      <div className="my-2 w-full text-left">
        <NodeList nodes={nodes} animate={animate} onWidgetAction={handleAction} />
      </div>
    </GenUiErrorBoundary>
  );
}
