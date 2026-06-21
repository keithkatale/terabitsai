"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

export type AgentEvent = {
  id: string
  timestamp: string
  agent: "portfolio_manager" | "intelligence" | "quant" | "risk_critic" | "cage" | "executor" | "hitl" | "memory"
  phase: "OBSERVE" | "PLAN" | "ACT" | "REFLECT" | "EXECUTE" | "HITL" | "COMPLETE" | "ERROR"
  symbol?: string
  message: string
  metadata?: Record<string, unknown>
  side?: "BUY" | "SELL" | "FLAT"
  confidence?: number
}

const AGENT_COLORS: Record<AgentEvent["agent"], string> = {
  portfolio_manager: "text-blue-400",
  intelligence:      "text-purple-400",
  quant:             "text-cyan-400",
  risk_critic:       "text-amber-400",
  cage:              "text-red-400",
  executor:          "text-emerald-400",
  hitl:              "text-yellow-300",
  memory:            "text-slate-400"
}

const AGENT_LABELS: Record<AgentEvent["agent"], string> = {
  portfolio_manager: "PM",
  intelligence:      "INTEL",
  quant:             "QUANT",
  risk_critic:       "RISK",
  cage:              "CAGE",
  executor:          "EXEC",
  hitl:              "HITL",
  memory:            "MEM"
}

const PHASE_COLORS: Record<AgentEvent["phase"], string> = {
  OBSERVE:  "bg-slate-700 text-slate-300",
  PLAN:     "bg-blue-900/60 text-blue-300",
  ACT:      "bg-amber-900/60 text-amber-300",
  REFLECT:  "bg-purple-900/60 text-purple-300",
  EXECUTE:  "bg-emerald-900/60 text-emerald-300",
  HITL:     "bg-yellow-900/60 text-yellow-300",
  COMPLETE: "bg-green-900/60 text-green-300",
  ERROR:    "bg-red-900/60 text-red-300"
}

const SIDE_COLORS = {
  BUY:  "text-emerald-400",
  SELL: "text-red-400",
  FLAT: "text-slate-400"
}

interface AgentActivityFeedProps {
  events: AgentEvent[]
  className?: string
  maxVisible?: number
}

export function AgentActivityFeed({ events, className, maxVisible = 50 }: AgentActivityFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [events, autoScroll])

  const visible = events.slice(-maxVisible)

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono font-semibold text-slate-300 tracking-widest uppercase">Agent Activity</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{events.length} events</span>
          <button
            onClick={() => setAutoScroll((v) => !v)}
            className={cn(
              "text-xs px-2 py-0.5 rounded font-mono transition-colors",
              autoScroll ? "text-blue-400 bg-blue-900/30 hover:bg-blue-900/50" : "text-slate-500 hover:text-slate-400"
            )}
          >
            {autoScroll ? "LIVE" : "PAUSED"}
          </button>
        </div>
      </div>

      {/* Event Stream */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5 font-mono text-xs">
        {visible.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-600">
            <span>Waiting for agent activity…</span>
          </div>
        ) : (
          visible.map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-2 py-0.5 px-1 rounded hover:bg-slate-800/50 transition-colors"
            >
              {/* Time */}
              <span className="text-slate-600 shrink-0 mt-0.5">
                {event.timestamp.slice(11, 19)}
              </span>

              {/* Agent badge */}
              <span className={cn("shrink-0 font-bold w-10 text-right", AGENT_COLORS[event.agent])}>
                {AGENT_LABELS[event.agent]}
              </span>

              {/* Phase badge */}
              <span className={cn("shrink-0 rounded px-1 text-[10px] uppercase font-semibold", PHASE_COLORS[event.phase])}>
                {event.phase}
              </span>

              {/* Symbol + Side */}
              {event.symbol && (
                <span className="text-slate-300 shrink-0">{event.symbol}</span>
              )}
              {event.side && (
                <span className={cn("shrink-0 font-bold", SIDE_COLORS[event.side])}>
                  {event.side}
                </span>
              )}
              {event.confidence !== undefined && (
                <span className="text-slate-500 shrink-0">
                  {(event.confidence * 100).toFixed(0)}%
                </span>
              )}

              {/* Message */}
              <span className="text-slate-400 truncate flex-1">{event.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

/**
 * Hook for connecting to the agent activity WebSocket stream.
 */
export function useAgentActivityStream(maxEvents = 200): AgentEvent[] {
  const [events, setEvents] = useState<AgentEvent[]>([])

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch("/api/engine/activity", { credentials: "include" })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as AgentEvent[]
        if (Array.isArray(data)) {
          setEvents(data.slice(0, maxEvents))
        }
      } catch {
        // Non-fatal
      }
    }

    void poll()
    const pollInterval = setInterval(poll, 15_000)

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL
    if (!wsUrl) {
      return () => {
        cancelled = true
        clearInterval(pollInterval)
      }
    }

    let ws: WebSocket
    let reconnectTimeout: ReturnType<typeof setTimeout>

    const connect = () => {
      ws = new WebSocket(wsUrl)

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data) as AgentEvent
          if (data.id && data.agent) {
            setEvents((prev) => [data, ...prev].slice(0, maxEvents))
          }
        } catch {
          // Ignore malformed events
        }
      }

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connect, 3_000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      cancelled = true
      clearInterval(pollInterval)
      clearTimeout(reconnectTimeout)
      ws?.close()
    }
  }, [maxEvents])

  return events
}
