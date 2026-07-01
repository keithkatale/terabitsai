"use client";

import { cn } from "@/lib/utils";
import type { ChatToolPod } from "@/lib/chat/stream-types";
import { ORCHESTRATOR_HIGHLIGHT, ORCHESTRATOR_STATUS_CLASS } from "@/components/ai-elements/agent-visual-constants";
import { TraceShimmerText } from "@/components/ai-elements/shimmer";
import { ActivitySpinner } from "@/components/ai-elements/activity-spinner";

const TOOL_LABELS: Record<string, string> = {
  analyze_chart: "Chart analysis",
  apply_chart_drawings: "Chart drawings",
  get_asset_market_data: "Market data",
  render_asset_chart: "Price chart",
  render_comparative_chart: "Compare assets",
  search_market_intel: "Market intel",
  get_catalyst_brief: "Catalyst brief",
  get_fundamentals: "Fundamentals",
  get_macro_data: "Macro data",
  query_trading_knowledge: "Knowledge lookup",
  get_market_overview: "Market overview",
  get_account_state: "Account state",
  manage_goals: "Goals",
  spawn_subagents: "Sub-agent team",
  get_all_assets: "Asset catalog",
};

function humanizeToolName(name: string): string {
  return TOOL_LABELS[name] ?? name.replace(/_/g, " ");
}

function toolContextLine(pod: ChatToolPod): string | null {
  const args = pod.args;
  if (!args) return null;

  const sym = args.symbol ?? args.asset_symbol ?? args.query;
  if (typeof sym === "string" && sym.trim()) return sym.trim().toUpperCase();

  if (pod.name === "spawn_subagents" && Array.isArray(args.subagents)) {
    const n = args.subagents.length;
    return n > 0 ? `${n} agent${n === 1 ? "" : "s"}` : null;
  }

  if (pod.name === "get_market_overview" && Array.isArray(args.symbols)) {
    const syms = args.symbols.filter((s): s is string => typeof s === "string");
    if (syms.length > 0) return syms.slice(0, 3).join(", ").toUpperCase();
  }

  return null;
}

function statusLabel(pod: ChatToolPod): string {
  if (pod.status === "running") return "Running";
  if (pod.ok === false) return "Failed";
  return "Done";
}

/** Compact in-chain tool card — no raw JSON. */
export function ToolStepWidget({
  pod,
  active = false,
  compact = false,
}: {
  pod: ChatToolPod;
  active?: boolean;
  compact?: boolean;
}) {
  const title = humanizeToolName(pod.name);
  const context = toolContextLine(pod);
  const status = statusLabel(pod);
  const failed = pod.status === "done" && pod.ok === false;

  if (!active && pod.status === "done") {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-0.5 text-[10px]">
        <span className="text-zinc-500">{title}</span>
        {context ? <span className="text-zinc-600">{context}</span> : null}
        <span className={failed ? "text-red-400/80" : "text-zinc-600"}>{status}</span>
        {pod.durationMs != null ? (
          <span className="text-zinc-700">{pod.durationMs}ms</span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03]",
        compact ? "px-2 py-1" : "px-2.5 py-1.5",
        active && "border-white/[0.12] bg-white/[0.04]",
        failed && !active && "border-red-500/20",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        <TraceShimmerText
          text={title}
          active={active}
          loadingStyle="static"
          highlight={ORCHESTRATOR_HIGHLIGHT}
          className="min-w-0 text-[10px] leading-snug text-zinc-300"
        />
        {active ? <ActivitySpinner color={ORCHESTRATOR_HIGHLIGHT} sizeClassName="size-2.5" /> : null}
      </div>
      {context ? (
        <p className="hidden shrink-0 truncate text-[9px] text-zinc-500 sm:block">{context}</p>
      ) : null}
      <div className="shrink-0 text-right">
        <span
          className={cn(
            "text-[9px] font-medium",
            pod.status === "running"
              ? ORCHESTRATOR_STATUS_CLASS
              : failed
                ? "text-red-400"
                : "text-emerald-400/90",
          )}
        >
          {status}
        </span>
        {pod.durationMs != null && pod.status === "done" ? (
          <p className="text-[8px] text-zinc-600">{pod.durationMs}ms</p>
        ) : null}
      </div>
      {failed && pod.error ? (
        <p className="basis-full line-clamp-2 text-[9px] text-red-400/90">{pod.error}</p>
      ) : null}
    </div>
  );
}
