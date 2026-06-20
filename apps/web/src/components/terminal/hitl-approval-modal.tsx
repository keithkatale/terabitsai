"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

export type HITLApprovalRequest = {
  requestId: string
  symbol: string
  side: "BUY" | "SELL"
  confidence: number
  rationale: string
  agentVotes: Array<{ agent: string; side: string; confidence: number; note: string }>
  riskSummary: string
  triggerReasons: string[]
  expiresAt: string
  createdAt: string
}

interface HITLApprovalModalProps {
  request: HITLApprovalRequest
  onDecision: (decision: "APPROVED" | "REJECTED", note?: string) => void
  className?: string
}

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState("")

  useEffect(() => {
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now()
      if (ms <= 0) { setRemaining("EXPIRED"); return }
      const h = Math.floor(ms / 3_600_000)
      const m = Math.floor((ms % 3_600_000) / 60_000)
      const s = Math.floor((ms % 60_000) / 1_000)
      setRemaining(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`)
    }
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [expiresAt])

  return (
    <span className={cn("font-mono text-xs", remaining === "EXPIRED" ? "text-red-400" : "text-amber-400")}>
      Expires in {remaining}
    </span>
  )
}

function AgentVoteRow({ vote }: { vote: HITLApprovalRequest["agentVotes"][0] }) {
  const sideColor = vote.side === "BUY" ? "text-emerald-400" : vote.side === "SELL" ? "text-red-400" : "text-slate-400"
  const agentLabels: Record<string, string> = {
    intelligence: "INTEL",
    quant: "QUANT",
    risk_critic: "RISK"
  }

  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-slate-800/60 last:border-0">
      <span className="text-slate-500 font-mono text-xs w-14 shrink-0">{agentLabels[vote.agent] ?? vote.agent.toUpperCase()}</span>
      <span className={cn("font-bold text-xs w-10 shrink-0", sideColor)}>{vote.side}</span>
      <span className="text-slate-500 text-xs w-8 shrink-0">{(vote.confidence * 100).toFixed(0)}%</span>
      <span className="text-slate-400 text-xs leading-relaxed flex-1 min-w-0">{vote.note.slice(0, 120)}</span>
    </div>
  )
}

export function HITLApprovalModal({ request, onDecision, className }: HITLApprovalModalProps) {
  const [reviewerNote, setReviewerNote] = useState("")
  const [pending, setPending] = useState(false)
  const sideColor = request.side === "BUY" ? "text-emerald-400" : "text-red-400"
  const sideBg = request.side === "BUY" ? "bg-emerald-900/20 border-emerald-900/40" : "bg-red-900/20 border-red-900/40"

  const handleDecision = async (decision: "APPROVED" | "REJECTED") => {
    setPending(true)
    try {
      await fetch("/api/hitl/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: request.requestId, decision, reviewerNote, decidedAt: new Date().toISOString() })
      })
      onDecision(decision, reviewerNote)
    } catch (err) {
      console.error("[hitl-modal] Failed to submit decision:", err)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-4 max-w-xl w-full", className)}>
      {/* Header */}
      <div className={cn("rounded-lg border p-4", sideBg)}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className={cn("text-2xl font-bold font-mono", sideColor)}>{request.symbol}</span>
              <span className={cn("text-lg font-bold", sideColor)}>{request.side}</span>
              <span className="text-slate-400 text-sm">{(request.confidence * 100).toFixed(0)}% confidence</span>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">{request.rationale}</p>
          </div>
          <CountdownTimer expiresAt={request.expiresAt} />
        </div>
      </div>

      {/* HITL Triggers */}
      <div className="rounded-lg border border-amber-900/40 bg-amber-900/10 px-4 py-3">
        <div className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">Why Human Review is Required</div>
        <ul className="space-y-1">
          {request.triggerReasons.map((r, i) => (
            <li key={i} className="text-xs text-amber-200/80 flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">›</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Agent Votes */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 px-4 py-3">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Agent Votes</div>
        <div className="space-y-0">
          {request.agentVotes.map((vote, i) => (
            <AgentVoteRow key={i} vote={vote} />
          ))}
        </div>
      </div>

      {/* Risk Summary */}
      {request.riskSummary && (
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 px-4 py-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Risk Assessment</div>
          <p className="text-xs text-slate-400">{request.riskSummary}</p>
        </div>
      )}

      {/* Reviewer Note */}
      <textarea
        value={reviewerNote}
        onChange={(e) => setReviewerNote(e.target.value)}
        placeholder="Optional reviewer note…"
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none h-16 font-mono"
      />

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => handleDecision("REJECTED")}
          disabled={pending}
          className="flex-1 py-2.5 rounded-lg border border-red-900/60 bg-red-900/20 text-red-400 font-semibold text-sm hover:bg-red-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Processing…" : "✕ Reject Trade"}
        </button>
        <button
          onClick={() => handleDecision("APPROVED")}
          disabled={pending}
          className="flex-1 py-2.5 rounded-lg border border-emerald-900/60 bg-emerald-900/20 text-emerald-400 font-semibold text-sm hover:bg-emerald-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Processing…" : "✓ Approve Trade"}
        </button>
      </div>
    </div>
  )
}

/**
 * Hook that polls for pending HITL requests.
 */
export function useHITLRequests(): HITLApprovalRequest[] {
  const [requests, setRequests] = useState<HITLApprovalRequest[]>([])

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch("/api/hitl/pending")
        if (res.ok) {
          const data = await res.json() as HITLApprovalRequest[]
          setRequests(data)
        }
      } catch {
        // Non-fatal
      }
    }

    fetch_()
    const interval = setInterval(fetch_, 3_000)
    return () => clearInterval(interval)
  }, [])

  return requests
}
