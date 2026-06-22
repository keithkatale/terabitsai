"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Pause, Play, Power, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCountdown } from "@/lib/autonomous/cycle-config";
import { useAppTab } from "@/contexts/app-tab-context";

type AttentionPayload = {
  cycleIntervalMs: number;
  cycleIntervalLabel: string;
  lastAttentionAt: string | null;
  nextCycleAt: string | null;
  remainingMs: number;
  attentionState: "inactive" | "watching" | "checking" | "paused" | "stale";
  autonomousActive: boolean;
  workerStatus: string;
  goal?: { id: string; status: string; autonomousTrading: boolean; killSwitch: boolean } | null;
};

export function OrchestratorCycleControls() {
  const { setActiveTab } = useAppTab();
  const [attention, setAttention] = useState<AttentionPayload | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const tickFiredRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const refreshAttention = useCallback(async () => {
    try {
      const res = await fetch("/api/autonomous/attention");
      if (res.ok) setAttention(await res.json());
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    void refreshAttention();
    const es = new EventSource("/api/autonomous/stream");
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "update") void refreshAttention();
      } catch {
        /* ignore */
      }
    };
    const poll = window.setInterval(() => void refreshAttention(), 30_000);
    return () => {
      es.close();
      window.clearInterval(poll);
    };
  }, [refreshAttention]);

  useEffect(() => {
    tickFiredRef.current = false;
  }, [attention?.nextCycleAt]);

  useEffect(() => {
    if (!attention?.nextCycleAt || !attention.cycleIntervalMs) {
      setRemainingMs(attention?.remainingMs ?? 0);
      setProgress(0);
      return;
    }

    const tick = () => {
      const nextMs = new Date(attention.nextCycleAt!).getTime();
      const interval = attention.cycleIntervalMs;
      const rem = Math.max(0, nextMs - Date.now());
      setRemainingMs(rem);
      setProgress(Math.min(100, ((interval - rem) / interval) * 100));
      if (rem <= 0 && !tickFiredRef.current) {
        tickFiredRef.current = true;
        void refreshAttention();
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [attention?.nextCycleAt, attention?.cycleIntervalMs, attention?.remainingMs, refreshAttention]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const showControls =
    attention &&
    (attention.autonomousActive ||
      attention.attentionState === "paused" ||
      attention.goal != null);

  if (!showControls) return null;

  const { attentionState, autonomousActive } = attention;
  const isChecking = attentionState === "checking";
  const isPaused = attentionState === "paused" || attentionState === "inactive";
  const showCountdown = autonomousActive && !isPaused;

  const ringColor = isChecking
    ? "border-cyan-400/60"
    : isPaused
      ? "border-amber-500/40"
      : "border-emerald-500/40";

  const handlePause = async () => {
    if (!attention.goal?.id) return;
    setActionLoading("pause");
    try {
      await fetch("/api/autonomous/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId: attention.goal.id, pause: autonomousActive }),
      });
      await refreshAttention();
    } finally {
      setActionLoading(null);
      setOpen(false);
    }
  };

  const handleKill = async () => {
    if (!attention.goal?.id) return;
    setActionLoading("kill");
    try {
      await fetch("/api/autonomous/kill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flattenAll: false, goalId: attention.goal.id }),
      });
      await refreshAttention();
    } finally {
      setActionLoading(null);
      setOpen(false);
    }
  };

  return (
    <div ref={panelRef} className="absolute right-4 top-2 z-20 flex items-center gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-black/50 backdrop-blur-sm transition-shadow",
          ringColor,
          isChecking && "shadow-[0_0_16px_rgba(34,211,238,0.25)]",
          showCountdown && !isChecking && "shadow-[0_0_12px_rgba(52,211,153,0.15)]",
        )}
        style={
          showCountdown
            ? {
                background: `conic-gradient(rgb(34 211 238 / 0.4) ${progress}%, rgb(0 0 0 / 0.5) ${progress}%)`,
              }
            : undefined
        }
        title={
          isChecking
            ? "Orchestrator checking markets"
            : showCountdown
              ? `Next cycle in ${formatCountdown(remainingMs)}`
              : "Autonomous trading paused"
        }
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--terminal-surface)]">
          {isChecking ? (
            <Loader2 className="size-3.5 animate-spin text-cyan-400" />
          ) : showCountdown ? (
            <span className="text-[9px] font-bold tabular-nums leading-none text-cyan-300">
              {formatCountdown(remainingMs)}
            </span>
          ) : (
            <Pause className="size-3 text-amber-400" />
          )}
        </span>
        {autonomousActive && showCountdown ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
          </span>
        ) : null}
      </button>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-zinc-400 backdrop-blur-sm hover:text-white"
        aria-label="Autonomous controls"
      >
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="absolute right-0 top-11 w-52 rounded-xl border border-white/10 bg-[var(--terminal-surface)]/95 p-2 shadow-xl backdrop-blur-md">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Autonomous manager
          </p>
          <button
            type="button"
            onClick={() => void handlePause()}
            disabled={!!actionLoading || !attention.goal?.id}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-zinc-200 hover:bg-white/5 disabled:opacity-50"
          >
            {autonomousActive ? (
              <Pause className="size-3.5 text-amber-400" />
            ) : (
              <Play className="size-3.5 text-emerald-400" />
            )}
            {actionLoading === "pause"
              ? "Updating…"
              : autonomousActive
                ? "Pause autonomous trading"
                : "Resume autonomous trading"}
          </button>
          <button
            type="button"
            onClick={() => void handleKill()}
            disabled={!!actionLoading || !attention.goal?.id}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
          >
            <Power className="size-3.5" />
            {actionLoading === "kill" ? "Stopping…" : "Kill switch (stop all)"}
          </button>
          <div className="my-1 border-t border-white/8" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setActiveTab("investing");
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
          >
            <Settings2 className="size-3.5" />
            More in Investing settings
          </button>
        </div>
      ) : null}
    </div>
  );
}
