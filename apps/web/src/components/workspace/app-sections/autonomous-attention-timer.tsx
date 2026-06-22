"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Eye, Loader2, PauseCircle, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCountdown } from "@/lib/autonomous/cycle-config";

type AttentionPayload = {
  cycleIntervalMs: number;
  cycleIntervalLabel: string;
  lastAttentionAt: string | null;
  nextCycleAt: string | null;
  remainingMs: number;
  attentionState: "inactive" | "watching" | "checking" | "paused" | "stale";
  autonomousActive: boolean;
  workerStatus: string;
};

type Props = {
  attention: AttentionPayload | null;
  onTick?: () => void;
};

function relativeAgo(iso: string | null): string {
  if (!iso) return "never";
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

export function AutonomousAttentionTimer({ attention, onTick }: Props) {
  const [remainingMs, setRemainingMs] = useState(attention?.remainingMs ?? 0);
  const [progress, setProgress] = useState(0);
  const tickFiredRef = useRef(false);

  useEffect(() => {
    tickFiredRef.current = false;
  }, [attention?.nextCycleAt, attention?.lastAttentionAt]);

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
        onTick?.();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [attention?.nextCycleAt, attention?.cycleIntervalMs, attention?.remainingMs, onTick]);

  if (!attention) {
    return (
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 animate-pulse">
        <div className="h-16 rounded-lg bg-white/5" />
      </div>
    );
  }

  const { attentionState, cycleIntervalLabel, lastAttentionAt, autonomousActive } = attention;

  const stateConfig = {
    inactive: {
      label: "Not watching",
      sub: "Set a balance goal and enable autonomous trading",
      icon: PauseCircle,
      tone: "text-zinc-400",
      ring: "border-zinc-600/40",
      pulse: false,
    },
    paused: {
      label: "Paused",
      sub: "Autonomous trading is off or goal is paused",
      icon: PauseCircle,
      tone: "text-amber-400",
      ring: "border-amber-500/30",
      pulse: false,
    },
    stale: {
      label: "Reconnecting",
      sub: "Worker heartbeat delayed — cycles may resume shortly",
      icon: Loader2,
      tone: "text-amber-400",
      ring: "border-amber-500/30",
      pulse: false,
    },
    checking: {
      label: "Checking markets",
      sub: "Your manager is analyzing opportunities now",
      icon: Loader2,
      tone: "text-cyan-300",
      ring: "border-cyan-400/50",
      pulse: true,
    },
    watching: {
      label: "Watching your goal",
      sub: `Next attention cycle in ${formatCountdown(remainingMs)}`,
      icon: Eye,
      tone: "text-emerald-400",
      ring: "border-emerald-500/40",
      pulse: true,
    },
  }[attentionState];

  const Icon = stateConfig.icon;
  const showCountdown = autonomousActive && attentionState !== "inactive" && attentionState !== "paused";

  return (
    <div className="rounded-xl border border-cyan-500/15 bg-gradient-to-br from-cyan-500/[0.06] to-transparent p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex shrink-0 items-center justify-center">
          <div
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-full border-2 bg-black/30",
              stateConfig.ring,
              stateConfig.pulse && autonomousActive && "shadow-[0_0_24px_rgba(34,211,238,0.15)]"
            )}
            style={
              showCountdown
                ? {
                    background: `conic-gradient(rgb(34 211 238 / 0.35) ${progress}%, rgb(255 255 255 / 0.04) ${progress}%)`,
                  }
                : undefined
            }
          >
            <div className="flex h-[52px] w-[52px] flex-col items-center justify-center rounded-full bg-[var(--terminal-surface)]">
              {attentionState === "checking" ? (
                <Loader2 className={cn("size-5 animate-spin", stateConfig.tone)} />
              ) : showCountdown ? (
                <>
                  <span className={cn("text-sm font-bold tabular-nums leading-none", stateConfig.tone)}>
                    {formatCountdown(remainingMs)}
                  </span>
                  <span className="mt-0.5 text-[8px] uppercase tracking-wider text-zinc-500">next</span>
                </>
              ) : (
                <Icon className={cn("size-5", stateConfig.tone)} />
              )}
            </div>
          </div>
          {stateConfig.pulse && autonomousActive ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-40" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-400" />
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Radio className={cn("size-3.5", autonomousActive ? "text-cyan-400" : "text-zinc-600")} />
            <h2 className={cn("text-sm font-semibold", stateConfig.tone)}>{stateConfig.label}</h2>
            {autonomousActive ? (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                Active
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-zinc-400">{stateConfig.sub}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-500">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              Cycle every {cycleIntervalLabel}
            </span>
            {lastAttentionAt ? (
              <span>Last attention {relativeAgo(lastAttentionAt)}</span>
            ) : (
              <span>Awaiting first cycle</span>
            )}
          </div>
        </div>
      </div>

      {showCountdown ? (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500/80 to-cyan-300/80 transition-[width] duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
