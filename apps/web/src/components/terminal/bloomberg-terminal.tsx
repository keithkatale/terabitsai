"use client"

import { useState } from "react"
import { AgentActivityFeed, useAgentActivityStream } from "./agent-activity-feed"
import { RiskMetricsPanel, useRiskMetrics } from "./risk-metrics-panel"
import { HITLApprovalModal, useHITLRequests, type HITLApprovalRequest } from "./hitl-approval-modal"
import { TradeBlotter, useTradeBlotter } from "./trade-blotter"
import { TradingWorkspace } from "@/components/workspace/trading-workspace"
import { AppTabProvider } from "@/contexts/app-tab-context"
import { cn } from "@/lib/utils"

type Tab = "chat" | "blotter"

/**
 * Bloomberg Terminal — the main professional trading dashboard.
 * Three-column layout: Chat+Blotter | Agent Activity | Risk+HITL
 */
export function BloombergTerminal() {
  const agentEvents = useAgentActivityStream()
  const riskMetrics = useRiskMetrics()
  const hitlRequests = useHITLRequests()
  const blotterEntries = useTradeBlotter()
  const [activeTab, setActiveTab] = useState<Tab>("chat")
  const [dismissedHITL, setDismissedHITL] = useState<Set<string>>(new Set())

  const pendingHITL = hitlRequests.filter((r) => !dismissedHITL.has(r.requestId))

  const handleHITLDecision = (request: HITLApprovalRequest, decision: "APPROVED" | "REJECTED") => {
    setDismissedHITL((prev) => new Set([...prev, request.requestId]))
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-950 font-mono">

      {/* ── Column 1: Chat / Blotter ────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 border-r border-slate-800/60">
        {/* Tab Bar */}
        <div className="flex border-b border-slate-800/60 bg-slate-950">
          {(["chat", "blotter"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 text-xs font-mono uppercase tracking-widest transition-colors border-b-2",
                activeTab === tab
                  ? "text-blue-400 border-blue-500 bg-blue-900/10"
                  : "text-slate-500 border-transparent hover:text-slate-400"
              )}
            >
              {tab === "chat" ? "AI Chat" : "Trade Blotter"}
              {tab === "blotter" && blotterEntries.length > 0 && (
                <span className="ml-2 bg-slate-800 text-slate-400 rounded px-1 text-[10px]">
                  {blotterEntries.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "chat" ? (
            <AppTabProvider>
              <TradingWorkspace />
            </AppTabProvider>
          ) : (
            <TradeBlotter entries={blotterEntries} className="h-full" />
          )}
        </div>
      </div>

      {/* ── Column 2: Agent Activity Feed ─────────────────────────────── */}
      <div className="flex flex-col w-80 xl:w-96 border-r border-slate-800/60 bg-slate-950/50">
        <AgentActivityFeed
          events={agentEvents}
          className="flex-1"
        />
      </div>

      {/* ── Column 3: Risk + HITL ───────────────────────────────────────── */}
      <div className="flex flex-col w-72 xl:w-80 bg-slate-950/80">
        {/* Risk Metrics */}
        <div className="border-b border-slate-800/60">
          <RiskMetricsPanel metrics={riskMetrics} />
        </div>

        {/* HITL Approvals */}
        <div className="flex-1 overflow-y-auto">
          {pendingHITL.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-700 px-4">
              <div className="w-8 h-8 rounded-full border border-slate-800 flex items-center justify-center">
                <span className="text-slate-600 text-lg">✓</span>
              </div>
              <span className="text-xs text-center">No pending approvals</span>
            </div>
          ) : (
            <div className="p-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-widest">
                  {pendingHITL.length} Approval{pendingHITL.length !== 1 ? "s" : ""} Required
                </span>
              </div>
              {pendingHITL.map((request) => (
                <HITLApprovalModal
                  key={request.requestId}
                  request={request}
                  onDecision={(decision, note) => handleHITLDecision(request, decision)}
                  className="border border-amber-900/30 rounded-xl p-3 bg-slate-900/60"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
