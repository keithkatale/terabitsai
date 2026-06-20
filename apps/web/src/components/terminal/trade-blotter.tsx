"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

export type BlotterEntry = {
  id: string
  symbol: string
  side: "BUY" | "SELL"
  volume: number
  entryPrice: number
  exitPrice?: number
  stopLoss?: number
  takeProfit?: number
  status: "PENDING" | "FILLED" | "PARTIAL" | "CANCELLED" | "PAPER_FILLED"
  dealId?: string
  pnl?: number
  confidence: number
  rationale: string
  agentVotes?: Array<{ agent: string; side: string; confidence: number }>
  createdAt: string
  filledAt?: string
}

interface TradeBlotterProps {
  entries: BlotterEntry[]
  className?: string
}

export function TradeBlotter({ entries, className }: TradeBlotterProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const sorted = [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
        <span className="text-xs font-mono font-semibold text-slate-300 tracking-widest uppercase">Trade Blotter</span>
        <span className="text-xs text-slate-500">{entries.length} orders</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-slate-600 text-xs">
            No trades recorded
          </div>
        ) : (
          <table className="w-full text-xs font-mono">
            <thead className="sticky top-0 bg-slate-950">
              <tr className="text-slate-500 border-b border-slate-800">
                <th className="text-left px-3 py-1.5">Time</th>
                <th className="text-left px-2 py-1.5">Symbol</th>
                <th className="text-left px-2 py-1.5">Side</th>
                <th className="text-right px-2 py-1.5">Vol</th>
                <th className="text-right px-2 py-1.5">Price</th>
                <th className="text-right px-2 py-1.5">P&L</th>
                <th className="text-left px-2 py-1.5">Status</th>
                <th className="text-center px-2 py-1.5">Conf</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry) => (
                <>
                  <tr
                    key={entry.id}
                    onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-1.5 text-slate-500">{entry.createdAt.slice(11, 19)}</td>
                    <td className="px-2 py-1.5 text-slate-200 font-semibold">{entry.symbol}</td>
                    <td className={cn("px-2 py-1.5 font-bold", entry.side === "BUY" ? "text-emerald-400" : "text-red-400")}>
                      {entry.side}
                    </td>
                    <td className="px-2 py-1.5 text-right text-slate-300">{entry.volume}</td>
                    <td className="px-2 py-1.5 text-right text-slate-300">
                      {entry.exitPrice ?? entry.entryPrice}
                    </td>
                    <td className={cn("px-2 py-1.5 text-right font-semibold",
                      entry.pnl === undefined ? "text-slate-500"
                      : entry.pnl > 0 ? "text-emerald-400"
                      : entry.pnl < 0 ? "text-red-400" : "text-slate-400"
                    )}>
                      {entry.pnl !== undefined
                        ? `${entry.pnl >= 0 ? "+" : ""}$${Math.abs(entry.pnl).toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="px-2 py-1.5">
                      <StatusBadge status={entry.status} />
                    </td>
                    <td className="px-2 py-1.5 text-center text-slate-400">
                      {(entry.confidence * 100).toFixed(0)}%
                    </td>
                  </tr>
                  {expanded === entry.id && (
                    <tr key={`${entry.id}-detail`} className="bg-slate-900/60">
                      <td colSpan={8} className="px-4 py-3">
                        <div className="space-y-2">
                          <p className="text-slate-400 text-xs">{entry.rationale}</p>
                          {entry.agentVotes && entry.agentVotes.length > 0 && (
                            <div className="flex gap-3">
                              {entry.agentVotes.map((v, i) => (
                                <span key={i} className="text-[10px] bg-slate-800 rounded px-2 py-0.5">
                                  <span className="text-slate-500">{v.agent}: </span>
                                  <span className={v.side === "BUY" ? "text-emerald-400" : v.side === "SELL" ? "text-red-400" : "text-slate-400"}>
                                    {v.side} {(v.confidence * 100).toFixed(0)}%
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                          {entry.stopLoss && (
                            <span className="text-[10px] text-slate-500">
                              SL: {entry.stopLoss} | TP: {entry.takeProfit ?? "—"} | Deal: {entry.dealId ?? "—"}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: BlotterEntry["status"] }) {
  const config = {
    FILLED:       { color: "text-emerald-400", bg: "bg-emerald-900/30" },
    PAPER_FILLED: { color: "text-blue-400",    bg: "bg-blue-900/30" },
    PENDING:      { color: "text-amber-400",   bg: "bg-amber-900/30" },
    PARTIAL:      { color: "text-yellow-400",  bg: "bg-yellow-900/30" },
    CANCELLED:    { color: "text-slate-400",   bg: "bg-slate-800/50" }
  }[status]

  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", config.color, config.bg)}>
      {status === "PAPER_FILLED" ? "PAPER" : status}
    </span>
  )
}

/**
 * Hook that polls the orders API for blotter data.
 */
export function useTradeBlotter(): BlotterEntry[] {
  const [entries, setEntries] = useState<BlotterEntry[]>([])

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch("/api/terminal/orders")
        if (res.ok) {
          const data = await res.json() as BlotterEntry[]
          setEntries(data)
        }
      } catch {
        // Non-fatal
      }
    }

    fetch_()
    const interval = setInterval(fetch_, 10_000)
    return () => clearInterval(interval)
  }, [])

  return entries
}
