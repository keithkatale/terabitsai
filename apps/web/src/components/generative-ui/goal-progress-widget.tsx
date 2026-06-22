"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { useChatWidgetAction } from "@/contexts/chat-widget-context";
import { Target, Pause, Play, XCircle, Zap, ZapOff, Loader2 } from "lucide-react";

export interface GoalProgressWidgetProps {
  goalId?: string;
  mode?: "demo" | "live";
  initialBalance?: number;
  targetBalance?: number;
  currentBalance?: number;
  progressPct?: number;
  status?: string;
  autonomousTrading?: boolean;
  deadlineAt?: string | null;
  description?: string | null;
  failureReason?: string | null;
}

type GoalAction =
  | "pause_goal"
  | "resume_goal"
  | "enable_autonomous"
  | "disable_autonomous"
  | "cancel";

function formatUsd(value: number) {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusTone(status?: string) {
  switch (status) {
    case "achieved":
      return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    case "failed":
      return "text-rose-400 border-rose-500/30 bg-rose-500/10";
    case "paused":
      return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    case "at_risk":
    case "in_progress":
      return "text-cyan-400 border-cyan-500/30 bg-cyan-500/10";
    default:
      return "text-zinc-300 border-white/10 bg-white/[0.04]";
  }
}

export function GoalProgressWidget({
  goalId,
  mode = "demo",
  initialBalance = 0,
  targetBalance = 0,
  currentBalance = 0,
  progressPct = 0,
  status = "active",
  autonomousTrading = false,
  deadlineAt,
  description,
  failureReason,
}: GoalProgressWidgetProps) {
  const onWidgetAction = useChatWidgetAction();
  const [busy, setBusy] = useState<GoalAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState(status);
  const [localAutonomous, setLocalAutonomous] = useState(autonomousTrading);

  const clampedPct = Math.max(0, Math.min(100, progressPct));
  const isTerminal =
    localStatus === "achieved" || localStatus === "failed" || localStatus === "cancelled";

  const runAction = useCallback(
    async (operation: GoalAction) => {
      if (!goalId) {
        setError("Goal ID missing — ask the agent to refresh your goal.");
        return;
      }

      setBusy(operation);
      setError(null);

      try {
        const res = await fetch("/api/goals/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal_id: goalId, operation, mode }),
        });
        const json = (await res.json()) as { success?: boolean; error?: string };

        if (!res.ok || !json.success) {
          throw new Error(json.error ?? "Action failed");
        }

        switch (operation) {
          case "enable_autonomous":
            setLocalAutonomous(true);
            break;
          case "disable_autonomous":
            setLocalAutonomous(false);
            break;
          case "pause_goal":
            setLocalStatus("paused");
            break;
          case "resume_goal":
            setLocalStatus("in_progress");
            break;
          case "cancel":
            setLocalStatus("cancelled");
            break;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Action failed";
        setError(message);
        onWidgetAction?.({
          type: "prompt",
          prompt: `manage_goals operation=${operation} goal_id=${goalId}`,
        });
      } finally {
        setBusy(null);
      }
    },
    [goalId, mode, onWidgetAction],
  );

  return (
    <div className="my-2 overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
            <Target className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Balance Goal</p>
            <p className="text-[11px] text-zinc-500">
              {description ?? `${formatUsd(initialBalance)} → ${formatUsd(targetBalance)}`}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            statusTone(localStatus),
          )}
        >
          {localStatus.replace("_", " ")}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Start</p>
          <p className="text-sm font-bold tabular-nums text-zinc-300">{formatUsd(initialBalance)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Current</p>
          <p className="text-sm font-bold tabular-nums text-white">{formatUsd(currentBalance)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Target</p>
          <p className="text-sm font-bold tabular-nums text-cyan-300">{formatUsd(targetBalance)}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="text-zinc-500">Progress</span>
          <span className="font-semibold tabular-nums text-zinc-200">{clampedPct.toFixed(1)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${clampedPct}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-1">
          {localAutonomous ? (
            <Zap className="size-3 text-amber-400" />
          ) : (
            <ZapOff className="size-3" />
          )}
          {localAutonomous ? "Autonomous trading on" : "Manual confirmation required"}
        </span>
        {deadlineAt ? <span>Deadline: {new Date(deadlineAt).toLocaleDateString()}</span> : null}
      </div>

      {failureReason ? (
        <p className="mt-2 text-[11px] text-rose-400">{failureReason}</p>
      ) : null}
      {error ? <p className="mt-2 text-[11px] text-rose-400">{error}</p> : null}

      {!isTerminal && goalId ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {localStatus === "paused" ? (
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void runAction("resume_goal")}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-white/[0.08] disabled:opacity-50"
            >
              {busy === "resume_goal" ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Play className="size-3" />
              )}
              Resume
            </button>
          ) : (
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void runAction("pause_goal")}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-white/[0.08] disabled:opacity-50"
            >
              {busy === "pause_goal" ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Pause className="size-3" />
              )}
              Pause
            </button>
          )}
          <button
            type="button"
            disabled={busy != null}
            onClick={() =>
              void runAction(localAutonomous ? "disable_autonomous" : "enable_autonomous")
            }
            className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/15 disabled:opacity-50"
          >
            {busy === "enable_autonomous" || busy === "disable_autonomous" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : localAutonomous ? (
              <ZapOff className="size-3" />
            ) : (
              <Zap className="size-3" />
            )}
            {localAutonomous ? "Disable auto" : "Enable auto"}
          </button>
          <button
            type="button"
            disabled={busy != null}
            onClick={() => void runAction("cancel")}
            className="inline-flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/15 disabled:opacity-50"
          >
            {busy === "cancel" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <XCircle className="size-3" />
            )}
            Cancel goal
          </button>
        </div>
      ) : null}
    </div>
  );
}
