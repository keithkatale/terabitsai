"use client";

import { useCallback, useEffect, useState } from "react";
import { Power, Pause, Play, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TradingMode } from "@/lib/account/api";

type GoalPayload = {
  id: string;
  status: string;
  autonomous_trading: boolean;
  kill_switch: boolean;
  initial_balance?: number | null;
  target_balance?: number | null;
  progress_pct?: number | null;
  max_risk_per_trade?: number;
  confirmation_threshold_pct?: number;
  deadline_at?: string | null;
};

export function AutonomousSettingsPanel({ tradingMode }: { tradingMode: TradingMode }) {
  const [goal, setGoal] = useState<GoalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/autonomous/goal");
      if (res.ok) {
        const json = await res.json();
        setGoal(json.goal ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, tradingMode]);

  const handlePause = async () => {
    if (!goal) return;
    setActionLoading("pause");
    try {
      await fetch("/api/autonomous/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId: goal.id, pause: goal.autonomous_trading }),
      });
      await refresh();
    } finally {
      setActionLoading(null);
    }
  };

  const handleKill = async () => {
    if (!goal) return;
    setActionLoading("kill");
    try {
      await fetch("/api/autonomous/kill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flattenAll: false, goalId: goal.id }),
      });
      await refresh();
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-900/60 bg-zinc-950/30 p-4 animate-pulse">
        <div className="h-20 rounded-lg bg-white/5" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="rounded-xl border border-zinc-900/60 bg-zinc-950/30 p-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <Target className="size-4" />
          <p className="text-xs">No balance goal set. Use Command to define a target and enable autonomous trading.</p>
        </div>
      </div>
    );
  }

  const initial = goal.initial_balance ?? 0;
  const target = goal.target_balance ?? 0;

  return (
    <div className="rounded-xl border border-cyan-500/15 bg-gradient-to-br from-cyan-500/[0.04] to-transparent p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Autonomous trading</h3>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Goal ${initial.toLocaleString()} → ${target.toLocaleString()} ·{" "}
            {(goal.progress_pct ?? 0).toFixed(1)}% progress
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase",
            goal.autonomous_trading && !goal.kill_switch
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-amber-500/10 text-amber-400 border border-amber-500/20",
          )}
        >
          {goal.kill_switch ? "Killed" : goal.autonomous_trading ? "Active" : "Paused"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-zinc-500">
        <div className="rounded-lg border border-zinc-900/60 bg-black/20 px-2 py-1.5">
          <span className="block text-zinc-600">Max risk / trade</span>
          <span className="font-mono font-bold text-zinc-300">{goal.max_risk_per_trade ?? 5}%</span>
        </div>
        <div className="rounded-lg border border-zinc-900/60 bg-black/20 px-2 py-1.5">
          <span className="block text-zinc-600">Confirm above</span>
          <span className="font-mono font-bold text-zinc-300">
            {goal.confirmation_threshold_pct ?? 3}%
          </span>
        </div>
      </div>

      {goal.deadline_at ? (
        <p className="mt-2 text-[10px] text-zinc-600">
          Deadline: {new Date(goal.deadline_at).toLocaleDateString()}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handlePause()}
          disabled={!!actionLoading || goal.kill_switch}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2.5 py-1.5 text-[10px] font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          {goal.autonomous_trading ? (
            <Pause className="size-3" />
          ) : (
            <Play className="size-3" />
          )}
          {actionLoading === "pause"
            ? "…"
            : goal.autonomous_trading
              ? "Pause"
              : "Resume"}
        </button>
        <button
          type="button"
          onClick={() => void handleKill()}
          disabled={!!actionLoading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/5 px-2.5 py-1.5 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/15 disabled:opacity-50"
        >
          <Power className="size-3" />
          {actionLoading === "kill" ? "…" : "Kill switch"}
        </button>
      </div>
    </div>
  );
}
