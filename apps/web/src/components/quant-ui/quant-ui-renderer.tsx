"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ExternalLink, FileText, TrendingDown, TrendingUp } from "lucide-react";
import { parseQuantMarkup } from "@/lib/quant-ui/parser";
import type { QuantUiAccent, QuantUiNode } from "@/lib/quant-ui/types";
import { GenerativeUiRegistry, normalizeComponentName } from "@/components/generative-ui/registry";
import { GenUiErrorBoundary } from "@/components/generative-ui/genui-error-boundary";
import { useChatWidgetAction } from "@/contexts/chat-widget-context";
import type { WidgetAction } from "@/lib/chat/widget-actions";
import { validateQuantMarkup } from "@/lib/chat/artifact-segments";
import { QuantUiFailure } from "./quant-ui-failure";
import { QuantAssetCard, QuantChart } from "./quant-chart";
import { QuantCompareChart } from "./quant-compare-chart";
import type { ChartRange } from "@/lib/chat/chart-data-tool";

const ACCENTS: Record<QuantUiAccent, { text: string; soft: string; border: string }> = {
  cyan: { text: "text-cyan-300", soft: "bg-cyan-500/10", border: "border-cyan-500/20" },
  violet: { text: "text-violet-300", soft: "bg-violet-500/10", border: "border-violet-500/20" },
  emerald: { text: "text-emerald-300", soft: "bg-emerald-500/10", border: "border-emerald-500/20" },
  rose: { text: "text-rose-300", soft: "bg-rose-500/10", border: "border-rose-500/20" },
  amber: { text: "text-amber-300", soft: "bg-amber-500/10", border: "border-amber-500/20" },
  sky: { text: "text-sky-300", soft: "bg-sky-500/10", border: "border-sky-500/20" },
  zinc: { text: "text-zinc-300", soft: "bg-zinc-500/10", border: "border-zinc-700/30" },
};

function accent(name?: string) {
  const key = (name ?? "cyan") as QuantUiAccent;
  return ACCENTS[key] ?? ACCENTS.cyan;
}

function parseJsonAttr(raw?: string): Record<string, unknown> | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function QuantNodeView({
  node,
  onAction,
}: {
  node: QuantUiNode;
  onAction?: (action: WidgetAction) => void;
}) {
  const fire = (action: WidgetAction) => onAction?.(action);
  const a = node.attrs;

  switch (node.tag) {
    case "section": {
      const minimal = a.variant === "minimal";
      return (
        <section className={cn("w-full", minimal ? "py-0.5" : "quant-panel p-4")}>
          {a.title ? (
            <h3 className={cn("font-semibold text-white", minimal ? "text-xs text-zinc-400" : "text-sm")}>
              {a.title}
            </h3>
          ) : null}
          {a.subtitle ? (
            <p className={cn("mt-0.5", minimal ? "mb-2 text-[10px] text-zinc-600" : "mb-3 text-[11px] text-zinc-500")}>
              {a.subtitle}
            </p>
          ) : (
            <div className={minimal ? "mb-1.5" : "mb-2"} />
          )}
          <QuantNodeList nodes={node.children} onAction={onAction} />
        </section>
      );
    }

    case "grid": {
      const cols = Math.max(1, Math.min(4, Number(a.columns) || 2));
      const colClass =
        cols === 1
          ? "grid-cols-1"
          : cols === 2
            ? "grid-cols-1 sm:grid-cols-2"
            : cols === 3
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              : "grid-cols-2 lg:grid-cols-4";
      return (
        <div className={cn("grid gap-2", colClass)}>
          {node.children.map((child, i) => (
            <QuantNodeView key={i} node={child} onAction={onAction} />
          ))}
        </div>
      );
    }

    case "stack":
      return (
        <div className={cn("flex flex-col", a.gap === "sm" ? "gap-2" : a.gap === "lg" ? "gap-5" : "gap-3")}>
          <QuantNodeList nodes={node.children} onAction={onAction} />
        </div>
      );

    case "divider":
      return <div className="h-px w-full bg-zinc-800/70" />;

    case "heading": {
      const level = Math.min(4, Math.max(1, Number(a.level) || 2));
      const text = a.text ?? "";
      const cls = cn(
        "font-semibold text-white",
        level === 1 ? "text-lg" : level === 2 ? "text-base" : level === 3 ? "text-sm" : "text-xs",
      );
      if (level === 1) return <h1 className={cls}>{text}</h1>;
      if (level === 2) return <h2 className={cls}>{text}</h2>;
      if (level === 3) return <h3 className={cls}>{text}</h3>;
      return <h4 className={cls}>{text}</h4>;
    }

    case "text": {
      const tone = a.tone ?? "default";
      return (
        <p
          className={cn(
            "text-[13.5px] leading-relaxed",
            tone === "muted" ? "text-zinc-500" : tone === "strong" ? "font-semibold text-white" : "text-zinc-300",
          )}
        >
          {a.text ?? ""}
          <QuantNodeList nodes={node.children} onAction={onAction} />
        </p>
      );
    }

    case "badge": {
      const tok = accent(a.accent);
      return (
        <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", tok.soft, tok.border, tok.text)}>
          {a.text ?? a.label ?? ""}
        </span>
      );
    }

    case "citation":
      return (
        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-zinc-600">
          <ExternalLink className="size-3" />
          Source: {a.source ?? "Quant"}
          {a.href ? (
            <Link href={a.href} className="text-cyan-500/80 underline-offset-2 hover:underline">
              View
            </Link>
          ) : null}
        </p>
      );

    case "stat": {
      const tok = accent(a.accent);
      const trend = a.trend;
      const TrendIcon = trend === "down" ? TrendingDown : trend === "up" ? TrendingUp : null;
      return (
        <div className={cn("rounded-xl border bg-zinc-950/30 px-3 py-2.5", tok.border)}>
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{a.label}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className={cn("text-base font-semibold", tok.text)}>{a.value}</span>
            {TrendIcon ? <TrendIcon className={cn("size-3.5", tok.text)} /> : null}
            {a.delta ? <span className="text-[11px] text-zinc-400">{a.delta}</span> : null}
          </div>
        </div>
      );
    }

    case "metrics": {
      const cols = Math.max(1, Math.min(4, Number(a.columns) || 2));
      const colClass = cols === 1 ? "grid-cols-1" : cols === 3 ? "grid-cols-3" : "grid-cols-2";
      return (
        <div className={cn("grid gap-2", colClass)}>
          {node.children.map((child, i) => (
            <QuantNodeView key={i} node={child} onAction={onAction} />
          ))}
        </div>
      );
    }

    case "chart":
      return (
        <QuantChart
          symbol={a.symbol ?? "BTCUSD"}
          name={a.name}
          range={(a.range as ChartRange) ?? "1M"}
          variant={a.variant === "line" ? "line" : "area"}
          spot={a.spot}
          change={a.change}
          high={a.high}
          low={a.low}
          dataSource={a["data-source"] ?? a.source}
        />
      );

    case "asset-card":
      return (
        <QuantAssetCard
          symbol={a.symbol ?? "BTCUSD"}
          name={a.name}
          range={(a.range as ChartRange) ?? "1M"}
          spot={a.spot}
          change={a.change}
          trend={a.trend}
        />
      );

    case "compare":
      return (
        <QuantCompareChart symbol1={a.symbol1 ?? a.ticker1 ?? ""} symbol2={a.symbol2 ?? a.ticker2 ?? ""} range={a.range ?? "6M"} />
      );

    case "button": {
      const action = a.action ?? "prompt";
      const isPrimary = a.variant !== "secondary";
      const label = a.label ?? a.text ?? node.children[0]?.attrs.text ?? "Action";

      if (action === "navigate" && a.href) {
        const href = a.href;
        const external = href.startsWith("http");
        if (external) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "inline-flex items-center justify-center rounded-lg px-4 py-2 text-xs font-semibold transition-all",
                isPrimary
                  ? "border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
                  : "border border-zinc-700/60 bg-zinc-900/40 text-zinc-300 hover:border-zinc-600",
              )}
            >
              {label}
            </a>
          );
        }
        return (
          <Link
            href={href}
            className={cn(
              "inline-flex items-center justify-center rounded-lg px-4 py-2 text-xs font-semibold transition-all",
              isPrimary
                ? "border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
                : "border border-zinc-700/60 bg-zinc-900/40 text-zinc-300 hover:border-zinc-600",
            )}
          >
            {label}
          </Link>
        );
      }

      return (
        <button
          type="button"
          onClick={() => {
            if (action === "prompt") {
              fire({ type: "prompt", prompt: a.payload ?? label });
            } else if (action === "custom") {
              fire({ type: "custom", action: a.name ?? a.payload ?? "custom", data: parseJsonAttr(a.data) });
            }
          }}
          className={cn(
            "inline-flex items-center justify-center rounded-lg px-4 py-2 text-xs font-semibold transition-all active:scale-[0.98]",
            isPrimary
              ? "border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 hover:text-white"
              : "border border-zinc-700/60 bg-zinc-900/40 text-zinc-300 hover:border-zinc-600 hover:text-white",
          )}
        >
          {label}
        </button>
      );
    }

    case "study-link": {
      const title = a.title ?? "Research study";
      const description = a.description ?? a.summary;
      const studyId = a.id ?? a["study-id"] ?? "";
      return (
        <button
          type="button"
          onClick={() =>
            fire({
              type: "prompt",
              prompt: a.prompt ?? `Open and summarize study ${studyId}: ${title}`,
            })
          }
          className="flex w-full items-start gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3.5 text-left transition-colors hover:border-violet-500/40 hover:bg-violet-500/10"
        >
          <span className="rounded-lg bg-violet-500/10 p-2">
            <FileText className="size-4 text-violet-300" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-zinc-100">{title}</span>
            {description ? <span className="mt-0.5 block text-[12px] leading-relaxed text-zinc-400">{description}</span> : null}
            {studyId ? <span className="mt-1 block font-mono text-[10px] text-violet-400/80">{studyId}</span> : null}
          </span>
        </button>
      );
    }

    case "actions":
      return (
        <div className="flex flex-wrap gap-2 pt-1">
          <QuantNodeList nodes={node.children} onAction={onAction} />
        </div>
      );

    case "widget":
    case "component": {
      const name = normalizeComponentName(a.name ?? "");
      const props = parseJsonAttr(a.props) ?? parseJsonAttr(a.data) ?? {};
      return <GenerativeUiRegistry name={name} props={props} />;
    }

    default:
      return (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-400">
          Unknown Quant UI tag: <code className="font-mono">{node.tag}</code>
        </div>
      );
  }
}

function QuantNodeList({ nodes, onAction }: { nodes: QuantUiNode[]; onAction?: (action: WidgetAction) => void }) {
  if (nodes.length === 0) return null;
  return (
    <>
      {nodes.map((node, i) => (
        <QuantNodeView key={i} node={node} onAction={onAction} />
      ))}
    </>
  );
}

export function QuantUiRenderer({
  markup,
  onAction,
}: {
  markup: string;
  onAction?: (action: WidgetAction) => void;
}) {
  const nodes = React.useMemo(() => parseQuantMarkup(markup), [markup]);
  const contextAction = useChatWidgetAction();
  const handleAction = React.useCallback(
    (action: WidgetAction) => {
      onAction?.(action);
      contextAction?.(action);
    },
    [contextAction, onAction],
  );

  if (nodes.length === 0) {
    const validation = validateQuantMarkup(markup);
    return (
      <QuantUiFailure
        reason={validation.ok ? "No components were produced from this markup." : validation.reason}
        rawPayload={markup}
        errorDetails="QuantUI markup parsing produced no renderable nodes"
      />
    );
  }

  return (
    <GenUiErrorBoundary fallbackTitle="Dashboard failed to render" rawPayload={markup}>
      <div className="quant-ui my-2 w-full space-y-3 text-left">
        {nodes.map((node, i) => (
          <div key={i} className="quant-ui-enter animate-fade-in" style={{ animationDelay: `${Math.min(i * 60, 400)}ms` }}>
            <QuantNodeView node={node} onAction={handleAction} />
          </div>
        ))}
      </div>
    </GenUiErrorBoundary>
  );
}

export function resolveQuantUiMarkup(payload: unknown): string | null {
  if (typeof payload === "string" && payload.includes("<quant:")) return payload;
  if (payload && typeof payload === "object" && "quant_ui" in payload) {
    const m = (payload as { quant_ui: unknown }).quant_ui;
    return typeof m === "string" ? m : null;
  }
  return null;
}
