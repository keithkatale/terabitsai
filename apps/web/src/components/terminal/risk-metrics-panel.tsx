"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export type RiskMetrics = {
  circuitBreakerState: "CLOSED" | "OPEN" | "HALF_OPEN"
  circuitBreakerReason?: string
  dailyPnl: number
  dailyPnlPct: number
  dailyDrawdownPct: number
  consecutiveLosses: number
  openPositionCount: number
  exposurePct: number
  todayTrades: number
  winRate?: number
}

function MetricRow({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-800/60 last:border-0">
      <span className="text-slate-500 text-xs uppercase tracking-wide">{label}</span>
      <span className={cn("text-xs font-mono font-semibold", className)}>{value}</span>
    </div>
  )
}

function CircuitBreakerBadge({ state, reason }: { state: RiskMetrics["circuitBreakerState"]; reason?: string }) {
  const config = {
    CLOSED:    { color: "text-emerald-400", bg: "bg-emerald-900/30", dot: "bg-emerald-400", label: "CLOSED" },
    OPEN:      { color: "text-red-400",     bg: "bg-red-900/30",     dot: "bg-red-400 animate-pulse", label: "OPEN" },
    HALF_OPEN: { color: "text-amber-400",   bg: "bg-amber-900/30",   dot: "bg-amber-400", label: "HALF_OPEN" }
  }[state]

  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-md", config.bg)}>
      <span className={cn("w-2 h-2 rounded-full", config.dot)} />
      <div className="flex-1 min-w-0">
        <div className={cn("text-xs font-mono font-bold tracking-widest", config.color)}>
          CIRCUIT BREAKER {config.label}
        </div>
        {state !== "CLOSED" && reason && (
          <div className="text-[10px] text-slate-500 truncate">{reason}</div>
        )}
      </div>
    </div>
  )
}

interface RiskMetricsPanelProps {
  metrics?: RiskMetrics | null
  className?: string
}

export function RiskMetricsPanel({ metrics, className }: RiskMetricsPanelProps) {
  const pnlColor = !metrics ? "text-slate-500"
    : metrics.dailyPnl >= 0 ? "text-emerald-400" : "text-red-400"
  const drawdownColor = !metrics ? "text-slate-500"
    : metrics.dailyDrawdownPct < 0.02 ? "text-emerald-400"
    : metrics.dailyDrawdownPct < 0.04 ? "text-amber-400" : "text-red-400"

  return (
    <div className={cn("flex flex-col gap-2 p-3", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-mono font-semibold text-slate-300 tracking-widest uppercase">Risk Monitor</span>
      </div>

      {/* Circuit Breaker */}
      <CircuitBreakerBadge
        state={metrics?.circuitBreakerState ?? "CLOSED"}
        reason={metrics?.circuitBreakerReason}
      />

      {/* Metrics */}
      <div className="mt-1">
        <MetricRow
          label="Daily P&L"
          value={
            metrics
              ? `${metrics.dailyPnl >= 0 ? "+" : ""}$${metrics.dailyPnl.toFixed(2)} (${metrics.dailyPnlPct >= 0 ? "+" : ""}${(metrics.dailyPnlPct * 100).toFixed(2)}%)`
              : "—"
          }
          className={pnlColor}
        />
        <MetricRow
          label="Drawdown"
          value={metrics ? `${(metrics.dailyDrawdownPct * 100).toFixed(2)}%` : "—"}
          className={drawdownColor}
        />
        <MetricRow
          label="Exposure"
          value={metrics ? `${(metrics.exposurePct * 100).toFixed(1)}%` : "—"}
          className={metrics && metrics.exposurePct > 0.4 ? "text-amber-400" : "text-slate-300"}
        />
        <MetricRow
          label="Open Positions"
          value={metrics?.openPositionCount ?? "—"}
          className="text-slate-300"
        />
        <MetricRow
          label="Consec. Losses"
          value={metrics?.consecutiveLosses ?? "—"}
          className={
            !metrics ? "text-slate-500"
            : metrics.consecutiveLosses >= 3 ? "text-red-400"
            : metrics.consecutiveLosses >= 2 ? "text-amber-400" : "text-slate-300"
          }
        />
        <MetricRow
          label="Trades Today"
          value={metrics?.todayTrades ?? "—"}
          className="text-slate-300"
        />
        {metrics?.winRate !== undefined && (
          <MetricRow
            label="Win Rate (7d)"
            value={`${(metrics.winRate * 100).toFixed(0)}%`}
            className={metrics.winRate >= 0.55 ? "text-emerald-400" : metrics.winRate >= 0.45 ? "text-amber-400" : "text-red-400"}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Hook that polls the risk metrics API.
 */
export function useRiskMetrics(): RiskMetrics | null {
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null)

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch("/api/terminal/risk-metrics")
        if (res.ok) {
          const data = await res.json() as RiskMetrics
          setMetrics(data)
        }
      } catch {
        // Non-fatal — keep last known metrics
      }
    }

    fetch_()
    const interval = setInterval(fetch_, 5_000)
    return () => clearInterval(interval)
  }, [])

  return metrics
}
