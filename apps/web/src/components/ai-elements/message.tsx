"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { 
  Cpu, 
  Play, 
  CheckCircle2, 
  Loader2, 
  Terminal, 
  ChevronDown, 
  Search, 
  ChevronRight, 
  Code,
  Shield,
  HelpCircle,
  Copy,
  Check,
  X
} from "lucide-react";
import { AssistantSiriOrb } from "./assistant-siri-orb";
import { MarkdownContent } from "./markdown-content";
import { AssetLogoIcon } from "@/components/ui/asset-logo";

// --- Types ---
export interface MessagePart {
  type: "reasoning" | "text" | "trade-execution";
  text: string;
}

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant" | "system";
  parts: MessagePart[];
}

export interface SubagentData {
  role: string;
  asset_symbol: string;
  instruction: string;
  status: "idle" | "running" | "success" | "failed";
  report?: string;
}

export interface ChainStep {
  id: string;
  type: "thought" | "tool" | "subagents";
  label: string;
  description?: string;
  status: "complete" | "active" | "pending";
  toolName?: string;
  subagents?: SubagentData[];
}

export interface TradeData {
  id: string;
  symbol: string;
  direction: "BUY" | "SELL";
  entryPrice: number;
  closePrice?: number;
  size: number;
  leverage: number;
  margin: number;
  tp: number | null;
  sl: number | null;
  pnl?: number;
  status: "OPEN" | "CLOSED";
  timestamp: number;
}

// --- Live Client-Side Reasoning Stream Parser ---
export function parseReasoningText(rawText: string): ChainStep[] {
  const steps: ChainStep[] = [];
  const lines = rawText.split("\n");

  let currentSubagentsList: SubagentData[] = [];
  const subagentReports: Record<string, { report: string; status: "success" | "failed"; error?: string }> = {};

  // Step 1: Pre-scan for all completed subagents details and reports in the raw text
  const detailsMatches = Array.from(rawText.matchAll(/\[SUBAGENTS_DETAILS:\s*([\s\S]*?)\]/g));
  for (const m of detailsMatches) {
    try {
      const parsed = JSON.parse(m[1]);
      if (Array.isArray(parsed)) {
        currentSubagentsList = parsed.map((item: any) => ({
          role: item.role || item.role_name || "",
          asset_symbol: item.asset_symbol || item.symbol || "",
          instruction: item.instruction || "",
          status: "idle"
        }));
      }
    } catch (e) {
      try {
        const parsed = JSON.parse(m[1] + "]");
        if (Array.isArray(parsed)) currentSubagentsList = parsed;
      } catch (e2) {
        // ignore incomplete stream
      }
    }
  }

  const reportMatches = Array.from(rawText.matchAll(/\[SUBAGENT_REPORT:\s*([\s\S]*?)\]/g));
  for (const m of reportMatches) {
    try {
      const parsed = JSON.parse(m[1]);
      if (parsed && parsed.role) {
        subagentReports[parsed.role] = {
          report: parsed.report || "",
          status: parsed.status || "success",
          error: parsed.error
        };
      }
    } catch (e) {
      try {
        const parsed = JSON.parse(m[1] + "}");
        if (parsed && parsed.role) {
          subagentReports[parsed.role] = {
            report: parsed.report || "",
            status: parsed.status || "success"
          };
        }
      } catch (e2) {
        // ignore
      }
    }
  }

  // Step 2: Line-by-line step construction
  let currentStep: ChainStep | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("[SUBAGENTS_DETAILS:") || trimmed.startsWith("[SUBAGENT_REPORT:") || trimmed.includes("SUBAGENT_REPORT:") || trimmed.includes("SUBAGENTS_DETAILS:")) {
      continue;
    }

    if (!trimmed) continue;

    if (trimmed.startsWith("Executing System Tool:")) {
      const match = trimmed.match(/Executing System Tool:\s*`([^`]+)`/);
      const toolName = match ? match[1] : "System Tool";

      currentStep = {
        id: `step-tool-${i}`,
        type: "tool",
        label: `Executing System Tool: \`${toolName}\``,
        toolName: toolName,
        status: "active"
      };
      steps.push(currentStep);
      continue;
    }

    if (trimmed.startsWith("Loaded") && trimmed.includes("assets from catalog")) {
      const lastToolStep = [...steps].reverse().find(s => s.type === "tool" && s.toolName === "get_all_assets");
      if (lastToolStep) {
        lastToolStep.status = "complete";
        lastToolStep.description = trimmed;
      }
      continue;
    }

    if (trimmed.startsWith("Retrieved detailed properties for asset")) {
      const lastToolStep = [...steps].reverse().find(s => s.type === "tool" && s.toolName === "get_asset_details");
      if (lastToolStep) {
        lastToolStep.status = "complete";
        lastToolStep.description = trimmed;
      }
      continue;
    }

    if (trimmed.startsWith("Spawning Subagent Team")) {
      currentStep = {
        id: `step-subagents-${i}`,
        type: "subagents",
        label: trimmed,
        status: "active",
        subagents: currentSubagentsList.map(sub => {
          const rState = subagentReports[sub.role];
          return {
            ...sub,
            status: rState ? (rState.status === "success" ? "success" : "failed") : "idle",
            report: rState?.report
          };
        })
      };
      steps.push(currentStep);
      continue;
    }

    if (trimmed.includes("is analyzing")) {
      const lastSubStep = [...steps].reverse().find(s => s.type === "subagents");
      if (lastSubStep && lastSubStep.subagents) {
        const roleMatch = trimmed.match(/^([^*]+)\s+is analyzing/);
        const role = roleMatch ? roleMatch[1].trim() : "";
        lastSubStep.subagents = lastSubStep.subagents.map(sub => {
          if (sub.role.toLowerCase() === role.toLowerCase() && sub.status === "idle") {
            return { ...sub, status: "running" };
          }
          return sub;
        });
      }
      continue;
    }

    if (trimmed.includes("finished analysis and submitted report!")) {
      const lastSubStep = [...steps].reverse().find(s => s.type === "subagents");
      if (lastSubStep && lastSubStep.subagents) {
        const roleMatch = trimmed.match(/^([^*]+)\s+finished analysis/);
        const role = roleMatch ? roleMatch[1].trim() : "";
        lastSubStep.subagents = lastSubStep.subagents.map(sub => {
          if (sub.role.toLowerCase() === role.toLowerCase()) {
            return { ...sub, status: "success", report: subagentReports[sub.role]?.report || sub.report };
          }
          return sub;
        });
      }
      continue;
    }

    if (trimmed.startsWith("All subagent analyses received successfully")) {
      const lastSubStep = [...steps].reverse().find(s => s.type === "subagents");
      if (lastSubStep) {
        lastSubStep.status = "complete";
        lastSubStep.description = trimmed;
        if (lastSubStep.subagents) {
          lastSubStep.subagents = lastSubStep.subagents.map(sub => ({
            ...sub,
            status: sub.status === "running" || sub.status === "idle" ? "success" : sub.status,
            report: subagentReports[sub.role]?.report || sub.report
          }));
        }
      }
      continue;
    }

    if (currentStep && currentStep.type === "thought" && currentStep.status === "active") {
      currentStep.description = (currentStep.description ? currentStep.description + "\n" : "") + trimmed;
    } else {
      currentStep = {
        id: `step-thought-${i}`,
        type: "thought",
        label: trimmed,
        status: "complete"
      };
      steps.push(currentStep);
    }
  }

  if (steps.length > 0) {
    const lastStep = steps[steps.length - 1];
    if (lastStep.type === "thought") {
      lastStep.status = "active";
    }
  }

  return steps;
}

// --- Typing dots ---
function TypingDots() {
  return (
    <span className="inline-flex shrink-0 items-end gap-[3px] pb-1 h-3" aria-hidden>
      <span className="inline-block size-[5px] animate-bounce rounded-full bg-[#24ee89] [animation-duration:0.6s]" />
      <span className="inline-block size-[5px] animate-bounce rounded-full bg-[#24ee89] [animation-duration:0.6s] [animation-delay:0.12s]" />
      <span className="inline-block size-[5px] animate-bounce rounded-full bg-[#24ee89] [animation-duration:0.6s] [animation-delay:0.24s]" />
    </span>
  );
}

// --- Subagent Card Widget (WOW Factor Interactive Panel!) ---
export function SubagentWidgetCard({ subagent }: { subagent: SubagentData }) {
  const [inspectOpen, setInspectOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"python" | "typescript">("python");
  const [copied, setCopied] = useState<string | null>(null);

  const codes = useMemo(() => {
    if (!subagent.report) return null;
    const pythonBlockMatch = subagent.report.match(/```python([\s\S]*?)```/);
    const tsBlockMatch = subagent.report.match(/```typescript([\s\S]*?)```/);

    if (pythonBlockMatch || tsBlockMatch) {
      return {
        python: pythonBlockMatch ? pythonBlockMatch[1].trim() : null,
        typescript: tsBlockMatch ? tsBlockMatch[1].trim() : null
      };
    }
    return null;
  }, [subagent.report]);

  const cleanReport = useMemo(() => {
    if (!subagent.report) return "";
    return subagent.report
      .replace(/```python[\s\S]*?```/g, "")
      .replace(/```typescript[\s\S]*?```/g, "")
      .trim();
  }, [subagent.report]);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const getStatusTheme = () => {
    switch (subagent.status) {
      case "success":
        return {
          border: "border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-emerald-950/20",
          bg: "bg-emerald-950/5",
          badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
          icon: CheckCircle2,
          text: "completed"
        };
      case "running":
        return {
          border: "border-sky-500/20 hover:border-sky-500/40 hover:shadow-sky-950/20 animate-pulse",
          bg: "bg-sky-950/5",
          badge: "text-sky-400 bg-sky-500/10 border-sky-500/20",
          icon: Loader2,
          text: "analyzing"
        };
      case "failed":
        return {
          border: "border-red-500/20 hover:border-red-500/40 hover:shadow-red-950/20",
          bg: "bg-red-950/5",
          badge: "text-red-400 bg-red-500/10 border-red-500/20",
          icon: Shield,
          text: "failed"
        };
      default:
        return {
          border: "border-zinc-800/40 hover:border-zinc-700/60 hover:shadow-zinc-950/10",
          bg: "bg-zinc-950/10",
          badge: "text-zinc-400 bg-zinc-800/10 border-zinc-800/20",
          icon: Play,
          text: "scout run"
        };
    }
  };

  const theme = getStatusTheme();
  const StatusIcon = theme.icon;

  return (
    <>
      <div 
        onClick={() => subagent.status !== "running" && setInspectOpen(true)}
        className={cn(
          "relative flex flex-col gap-2 p-3 rounded-lg border text-left bg-zinc-950/40 transition-all shadow-[0_4px_12px_rgba(0,0,0,0.15)] backdrop-blur-sm select-none",
          subagent.status !== "running" ? "cursor-pointer group hover:scale-[1.01]" : "cursor-default",
          theme.border,
          theme.bg
        )}
      >
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-white/[0.01] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 rounded items-center justify-center bg-zinc-900 border border-zinc-800 text-zinc-300">
              <Cpu className="h-3 w-3 text-zinc-400 group-hover:text-sky-400 transition-colors" />
            </div>
            <span className="font-semibold text-zinc-200 group-hover:text-white text-xs">{subagent.role}</span>
          </div>
          <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded border text-[9px] font-mono capitalize", theme.badge)}>
            <StatusIcon className={cn("h-2.5 w-2.5 shrink-0", subagent.status === "running" && "animate-spin")} />
            <span>{theme.text}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
          <span className="font-mono text-sky-400 bg-sky-500/5 px-1 py-0.5 rounded border border-sky-500/10">{subagent.asset_symbol}</span>
          <span className="truncate flex-1">Scope: {subagent.instruction}</span>
          {subagent.status !== "running" && (
            <ChevronRight className="h-3.5 w-3.5 text-zinc-500 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all shrink-0" />
          )}
        </div>
      </div>

      {inspectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 select-text">
          <div className="relative flex flex-col w-full max-w-4xl h-[85vh] rounded-2xl border border-zinc-800 bg-zinc-950 shadow-[0_24px_50px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900 bg-zinc-900/40">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-sky-400">
                  <Cpu className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-none">{subagent.role}</h3>
                  <span className="text-[10px] text-zinc-500 font-mono mt-1 block">Active on Asset: {subagent.asset_symbol}</span>
                </div>
              </div>
              <button 
                onClick={() => setInspectOpen(false)}
                className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-900/20 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                    <HelpCircle className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Purpose / Analytical Directive</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed font-sans">{subagent.instruction}</p>
                </div>

                <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-900/20 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                    <Shield className="h-3.5 w-3.5 text-zinc-400" />
                    <span>System Constraints</span>
                  </div>
                  <p className="text-[10px] font-mono text-zinc-500 leading-relaxed">
                    Strictly analytical focus. Mathematical indicators verified in backtesting. Report formatting outputs Markdown blocks containing dual quantitative codes. Temperature 0.2.
                  </p>
                </div>
              </div>

              {cleanReport && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-white border-b border-zinc-900 pb-1.5 flex items-center gap-2">
                    <Terminal className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Analytical Synthesis Report</span>
                  </h4>
                  <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950 text-xs text-zinc-300 leading-relaxed font-sans whitespace-pre-wrap space-y-2 select-text">
                    {cleanReport}
                  </div>
                </div>
              )}

              {codes && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-white pb-1.5 flex items-center justify-between border-b border-zinc-900">
                    <span className="flex items-center gap-2">
                      <Code className="h-3.5 w-3.5 text-zinc-400" />
                      <span>Quantitative Execution Models</span>
                    </span>
                    <div className="flex items-center gap-1 rounded bg-zinc-900 p-0.5 border border-zinc-800">
                      <button 
                        onClick={() => setActiveTab("python")}
                        className={cn("px-2 py-0.5 rounded text-[10px] transition-all cursor-pointer", activeTab === "python" ? "bg-zinc-800 text-white font-medium" : "text-zinc-500 hover:text-zinc-300")}
                      >
                        Python Indicators
                      </button>
                      <button 
                        onClick={() => setActiveTab("typescript")}
                        className={cn("px-2 py-0.5 rounded text-[10px] transition-all cursor-pointer", activeTab === "typescript" ? "bg-zinc-800 text-white font-medium" : "text-zinc-500 hover:text-zinc-300")}
                      >
                        TypeScript Trading System
                      </button>
                    </div>
                  </h4>

                  <div className="hidden lg:grid grid-cols-2 gap-4">
                    {codes.python && (
                      <div className="rounded-xl border border-zinc-900 bg-zinc-900/20 overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/50 border-b border-zinc-900/80">
                          <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                            indicator_calculation.py (Python)
                          </span>
                          <button
                            onClick={() => handleCopy(codes.python!, "py")}
                            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-all text-[10px] flex items-center gap-1 cursor-pointer"
                          >
                            {copied === "py" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                            <span>{copied === "py" ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                        <pre className="p-4 overflow-x-auto text-[11px] font-mono text-zinc-300 bg-black/40 leading-normal scrollbar-thin select-text flex-1">
                          <code>{codes.python}</code>
                        </pre>
                      </div>
                    )}

                    {codes.typescript && (
                      <div className="rounded-xl border border-zinc-900 bg-zinc-900/20 overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/50 border-b border-zinc-900/80">
                          <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                            signal_model.ts (TypeScript)
                          </span>
                          <button
                            onClick={() => handleCopy(codes.typescript!, "ts")}
                            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-all text-[10px] flex items-center gap-1 cursor-pointer"
                          >
                            {copied === "ts" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                            <span>{copied === "ts" ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                        <pre className="p-4 overflow-x-auto text-[11px] font-mono text-zinc-300 bg-black/40 leading-normal scrollbar-thin select-text flex-1">
                          <code>{codes.typescript}</code>
                        </pre>
                      </div>
                    )}
                  </div>

                  <div className="block lg:hidden rounded-xl border border-zinc-900 bg-zinc-900/20 overflow-hidden">
                    {activeTab === "python" && codes.python && (
                      <div className="flex flex-col">
                        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/50 border-b border-zinc-900/80">
                          <span className="text-[10px] font-mono text-zinc-400">indicator_calculation.py</span>
                          <button
                            onClick={() => handleCopy(codes.python!, "py")}
                            className="p-1 hover:bg-zinc-800 rounded text-[10px] text-zinc-400 cursor-pointer"
                          >
                            {copied === "py" ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <pre className="p-4 overflow-x-auto text-[11px] font-mono text-zinc-300 bg-black/40 leading-normal select-text">
                          <code>{codes.python}</code>
                        </pre>
                      </div>
                    )}

                    {activeTab === "typescript" && codes.typescript && (
                      <div className="flex flex-col">
                        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/50 border-b border-zinc-900/80">
                          <span className="text-[10px] font-mono text-zinc-400">signal_model.ts</span>
                          <button
                            onClick={() => handleCopy(codes.typescript!, "ts")}
                            className="p-1 hover:bg-zinc-800 rounded text-[10px] text-zinc-400 cursor-pointer"
                          >
                            {copied === "ts" ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <pre className="p-4 overflow-x-auto text-[11px] font-mono text-zinc-300 bg-black/40 leading-normal select-text">
                          <code>{codes.typescript}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// --- Activity Step Row ---
function ActivityStepRow({ step }: { step: ChainStep }) {
  const getStatusStyle = () => {
    switch (step.status) {
      case "complete":
        return {
          iconClass: "text-emerald-500 bg-emerald-500/5 border-emerald-500/20",
          textClass: "text-zinc-300 font-medium"
        };
      case "active":
        return {
          iconClass: "text-sky-400 bg-sky-500/5 border-sky-500/20 animate-pulse",
          textClass: "text-white font-semibold"
        };
      default:
        return {
          iconClass: "text-zinc-500 bg-neutral-950/20 border-zinc-800/50",
          textClass: "text-zinc-500"
        };
    }
  };

  const style = getStatusStyle();
  
  const getStepIcon = () => {
    if (step.type === "subagents") return Cpu;
    if (step.type === "tool") {
      if (step.toolName === "get_all_assets") return Search;
      if (step.toolName === "get_asset_details") return Search;
      return Terminal;
    }
    return Play;
  };

  const IconComponent = getStepIcon();

  return (
    <div className="flex gap-3 text-xs items-start">
      <div className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[11px] shadow-inner font-mono",
        style.iconClass
      )}>
        {step.status === "active" ? (
          <Loader2 className="h-3.5 w-3.5 text-sky-400 animate-spin" />
        ) : (
          <IconComponent className="h-3.5 w-3.5" />
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <span className={cn("block break-words text-[12.5px]", style.textClass)}>{step.label}</span>
        {step.description && (
          <span className="block text-zinc-400 font-normal leading-relaxed text-[11.5px] select-text">
            {step.description}
          </span>
        )}
        {step.type === "subagents" && step.subagents && step.subagents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-2.5 max-w-2xl">
            {step.subagents.map((sub, idx) => (
              <SubagentWidgetCard key={idx} subagent={sub} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Agent Activity Collapsible Surface ---
function AgentActivity({
  reasoning,
  isAssistantStreaming,
}: {
  reasoning: string;
  isAssistantStreaming: boolean;
}) {
  const parsedSteps = useMemo(() => parseReasoningText(reasoning), [reasoning]);
  
  if (parsedSteps.length === 0) {
    if (isAssistantStreaming) {
      return (
        <div className="flex items-center gap-2 py-1.5 border-b border-zinc-800/10 dark:border-white/[0.04] mb-3">
          <span className="text-xs font-semibold text-shimmer uppercase tracking-wider text-[#24ee89] dark:text-[#24ee89]">
            Analyzing markets
          </span>
          <TypingDots />
        </div>
      );
    }
    return null;
  }
  
  const total = parsedSteps.length;
  const completedSteps = parsedSteps.filter(s => s.status === "complete");
  const doneCount = completedSteps.length;
  
  const activeStepIdx = parsedSteps.findIndex(s => s.status === "active");
  const currentStepNum = activeStepIdx === -1 ? total : activeStepIdx + 1;
  const activeStep = activeStepIdx !== -1 ? parsedSteps[activeStepIdx] : null;

  if (isAssistantStreaming) {
    const label = activeStep ? activeStep.label : "Working";
    const detail = activeStep?.description || "";

    return (
      <details key="active" open className="group/act w-full max-w-full mb-3" role="status" aria-live="polite">
        <summary className="flex cursor-pointer list-none select-none items-center gap-2 py-1.5 [&::-webkit-details-marker]:hidden border-b border-zinc-800/10 dark:border-white/[0.04]">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-xs font-semibold text-shimmer uppercase tracking-wider text-[#24ee89] dark:text-[#24ee89]">
              {label}
              {detail ? <span className="ml-1.5 text-zinc-400 font-normal normal-case">· {detail}</span> : null}
            </span>
            <TypingDots />
            <ChevronDown className="size-3.5 shrink-0 text-[#24ee89] transition-transform group-open/act:rotate-180 ml-1 cursor-pointer" aria-hidden />
          </span>
          {total > 0 ? (
            <span className="ml-auto shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white/55 font-mono">
              {currentStepNum}/{total}
            </span>
          ) : null}
        </summary>
        <div className="ml-0.5 mt-2.5 space-y-3.5 border-l border-white/[0.08] pl-3.5 animate-in fade-in duration-200">
          {parsedSteps.map((step, idx) => (
            <ActivityStepRow key={step.id || idx} step={step} />
          ))}
        </div>
      </details>
    );
  }

  return (
    <details key="done" className="group/trace mb-3 w-full max-w-full">
      <summary className="cursor-pointer list-none select-none py-1 text-xs font-semibold text-zinc-400 marker:hidden transition-colors hover:text-zinc-200 uppercase tracking-wider [&::-webkit-details-marker]:hidden flex items-center gap-1.5 w-fit">
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform group-open/trace:rotate-180" aria-hidden />
        <span>How this reply was built</span>
        {total > 0 ? <span className="text-zinc-600 font-mono text-[10px] normal-case ml-1">· {doneCount}/{total} steps</span> : null}
      </summary>
      <div className="ml-0.5 mt-2 border-l border-zinc-800/10 pl-3.5 dark:border-white/[0.08] space-y-3.5 animate-in fade-in duration-200">
        {parsedSteps.map((step, idx) => (
          <ActivityStepRow key={step.id || idx} step={step} />
        ))}
      </div>
    </details>
  );
}

// --- Simulated Contract Card ---
export const TradeReceiptCard = ({
  trade,
  currentPrice,
  onClosePosition,
}: {
  trade: TradeData;
  currentPrice?: number;
  onClosePosition?: (id: string) => void;
}) => {
  const isClosed = trade.status === "CLOSED";
  
  const pnl = isClosed
    ? (trade.pnl || 0)
    : currentPrice
      ? trade.direction === "BUY"
        ? (currentPrice - trade.entryPrice) * trade.size
        : (trade.entryPrice - currentPrice) * trade.size
      : 0;

  const isProfitable = pnl >= 0;

  return (
    <div className={cn(
      "w-full max-w-sm rounded-xl border p-4 flex flex-col gap-3.5 bg-zinc-950/80 backdrop-blur-md shadow-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 mt-2",
      trade.direction === "BUY" ? "border-emerald-500/20 shadow-emerald-500/2" : "border-red-500/20 shadow-red-500/2"
    )}>
      <div className="flex items-center justify-between">
        <span className={cn(
          "text-[9px] font-extrabold px-2 py-0.5 rounded tracking-wider uppercase",
          trade.direction === "BUY" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
        )}>
          {trade.direction} SIMULATED CONTRACT
        </span>
        <span className="text-[10px] text-zinc-500 font-mono font-medium">{trade.id}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <AssetLogoIcon symbol={trade.symbol} size="sm" className="rounded-lg shadow-sm border border-zinc-900/10" />
          <div>
            <h4 className="text-base font-extrabold text-white tracking-tight leading-none">{trade.symbol}</h4>
            <p className="text-[10px] text-zinc-500 font-medium leading-none mt-1">Spot Leverage Multiplier: {trade.leverage}x</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[9px] text-zinc-500 block uppercase font-bold tracking-wide">Position Status</span>
          <span className={cn(
            "text-xs font-extrabold uppercase tracking-wide leading-none mt-0.5 inline-block",
            isClosed ? "text-zinc-500" : "text-emerald-400 animate-pulse"
          )}>
            {trade.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] border-y border-zinc-900/60 py-3 font-mono">
        <div className="flex justify-between">
          <span className="text-zinc-500">Entry Price</span>
          <span className="text-zinc-200">${trade.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Current Price</span>
          <span className="text-zinc-200">
            ${(isClosed ? (trade.closePrice || trade.entryPrice) : (currentPrice || trade.entryPrice)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Contract Size</span>
          <span className="text-zinc-200">{trade.size} units</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Required Margin</span>
          <span className="text-zinc-200">${(trade.margin || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <div>
          <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-wide leading-none mb-1">Simulated Net Profit & Loss</span>
          <span className={cn("text-base font-mono font-extrabold tracking-tight", isProfitable ? "text-emerald-400" : "text-red-400")}>
            {isProfitable ? "+" : ""}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {!isClosed && onClosePosition && (
          <button
            onClick={() => onClosePosition(trade.id)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-extrabold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all duration-300 shadow-md shadow-red-500/2 cursor-pointer"
          >
            Close Simulated CFD
          </button>
        )}
      </div>
    </div>
  );
};

// --- Unified Chat Message Component ---
export function ChatMessage({
  message,
  isAssistantStreaming = false,
  hideAssistantOrb = false,
  livePrices,
  onClosePosition,
  rootRef
}: {
  message: ChatMessageData;
  isAssistantStreaming?: boolean;
  hideAssistantOrb?: boolean;
  livePrices?: Record<string, any>;
  onClosePosition?: (id: string) => void;
  rootRef?: React.Ref<HTMLDivElement | null>;
}) {
  if (message.role === "user") {
    const userText = message.parts.filter(p => p.type === "text").map(p => p.text).join("");
    return (
      <div ref={rootRef} className="flex justify-end w-full animate-fade-in">
        <div className="max-w-[85%] sm:max-w-[640px] whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm sm:text-base font-normal leading-relaxed text-zinc-200 shadow-md font-sans">
          {userText}
        </div>
      </div>
    );
  }

  const reasoningParts = message.parts.filter(p => p.type === "reasoning");
  const reasoningText = reasoningParts.map(p => p.text).join("");
  const hasReasoning = reasoningText.trim().length > 0;

  return (
    <div 
      ref={rootRef}
      className={cn(
        "flex flex-col sm:flex-row justify-start w-full animate-fade-in", 
        hideAssistantOrb ? "gap-0" : "gap-2.5 sm:gap-4"
      )}
    >
      {!hideAssistantOrb ? (
        <div className="flex items-center gap-2.5 sm:block max-sm:mb-2 shrink-0">
          <AssistantSiriOrb active={isAssistantStreaming} sizePx={32} className="mt-0.5" />
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider sm:hidden">Co-pilot</span>
        </div>
      ) : null}
      <div className="w-full sm:max-w-[760px] min-w-0 flex-1 space-y-3.5 px-0.5 py-0.5">
        {hasReasoning ? (
          <AgentActivity
            reasoning={reasoningText}
            isAssistantStreaming={isAssistantStreaming}
          />
        ) : null}

        {message.parts.map((part, idx) => {
          if (part.type === "trade-execution") {
            try {
              const trade = typeof part.text === "string" ? JSON.parse(part.text) : part.text;
              const currentSpotPrice = livePrices && livePrices[trade.symbol] ? livePrices[trade.symbol].spot : trade.entryPrice;
              return (
                <TradeReceiptCard
                  key={`${message.id}-${idx}`}
                  trade={trade}
                  currentPrice={currentSpotPrice}
                  onClosePosition={onClosePosition}
                />
              );
            } catch (e) {
              console.error("Failed to parse trade JSON receipt:", e);
              return <p key={`${message.id}-${idx}`} className="text-xs text-red-400">Error rendering simulated CFD card</p>;
            }
          }
          
          if (part.type === "text" && part.text.trim()) {
            return (
              <MarkdownContent key={`${message.id}-${idx}`} markdown={part.text} />
            );
          }
          
          return null;
        })}
      </div>
    </div>
  );
}
