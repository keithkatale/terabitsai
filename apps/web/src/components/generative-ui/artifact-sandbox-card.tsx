"use client";

import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Code,
  Eye,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  RefreshCw,
  Download,
  TriangleAlert,
  Loader2,
} from "lucide-react";
import { useChatWidgetAction } from "@/contexts/chat-widget-context";
import type { WidgetAction } from "@/lib/chat/widget-actions";

interface ArtifactSandboxCardProps {
  code: string;
  language?: string;
  title?: string;
  onArtifactAction?: (action: WidgetAction) => void;
}

type SizePreset = "compact" | "default" | "tall";
const SIZE_PX: Record<SizePreset, number> = { compact: 240, default: 340, tall: 520 };

export function ArtifactSandboxCard({
  code,
  language = "html",
  title = "Interactive Artifact",
  onArtifactAction,
}: ArtifactSandboxCardProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [size, setSize] = useState<SizePreset>("default");
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const contextAction = useChatWidgetAction();

  const emitAction = useCallback(
    (action: WidgetAction) => {
      onArtifactAction?.(action);
      contextAction?.(action);
    },
    [contextAction, onArtifactAction],
  );

  const token = React.useMemo(() => `qa_${Math.random().toString(36).slice(2, 11)}`, []);

  const isSvg = code.trim().startsWith("<svg") || (code.trim().startsWith("<?xml") && code.includes("<svg"));

  const bridgeScript = `
    <script>
      (function () {
        var T = ${JSON.stringify(token)};
        var __quantSeq = 0;
        window.__quantPending = {};
        function send(payload) {
          try { parent.postMessage(Object.assign({ __quantArtifact: T }, payload), "*"); } catch (e) {}
        }
        window.addEventListener("message", function (e) {
          var d = e.data;
          if (!d || d.__quantArtifact !== T) return;
          if (d.kind === "complete_response") {
            var pending = window.__quantPending[d.id];
            if (!pending) return;
            if (d.error) pending.reject(new Error(d.error));
            else pending.resolve(d.text || "");
            delete window.__quantPending[d.id];
          }
        });
        window.addEventListener("error", function (e) {
          send({ kind: "error", message: (e && e.message) ? e.message : "Script error" });
        });
        window.addEventListener("unhandledrejection", function (e) {
          var r = e && e.reason;
          send({ kind: "error", message: r ? (r.message || String(r)) : "Unhandled promise rejection" });
        });
        window.addEventListener("DOMContentLoaded", function () { send({ kind: "ready" }); });
        window.__quant = {
          sendPrompt: function (prompt) {
            if (typeof prompt !== "string" || !prompt.trim()) return;
            send({ kind: "prompt", prompt: prompt.trim() });
          },
          sendAction: function (action, data) {
            send({ kind: "action", action: String(action || ""), data: data });
          },
          complete: function (prompt) {
            return new Promise(function (resolve, reject) {
              if (typeof prompt !== "string" || !prompt.trim()) {
                reject(new Error("Prompt is required"));
                return;
              }
              var id = "c" + (++__quantSeq);
              window.__quantPending[id] = { resolve: resolve, reject: reject };
              send({ kind: "complete_request", id: id, prompt: prompt.trim() });
            });
          }
        };
      })();
    </script>`;

  const compiledSrcDoc = React.useMemo(() => {
    const head = `
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      ${bridgeScript}
      <style>
        html, body { margin: 0; }
        body {
          padding: 16px;
          background-color: #050508;
          color: #e4e4e7;
          font-family: system-ui, -apple-system, sans-serif;
          box-sizing: border-box;
          ${isSvg ? "display:flex;align-items:center;justify-content:center;min-height:calc(100vh - 32px);" : ""}
        }
        * { box-sizing: border-box; }
        svg { max-width: 100%; }
        button { cursor: pointer; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #09090b; }
        ::-webkit-scrollbar-thumb { background: #27272a; border-radius: 9999px; }
        ::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
      </style>`;
    return `<!DOCTYPE html><html><head>${head}</head><body>${code}</body></html>`;
  }, [code, isSvg, bridgeScript]);

  const handleCompleteRequest = useCallback(
    async (id: string, prompt: string) => {
      const iframe = iframeRef.current;
      const postBack = (payload: Record<string, unknown>) => {
        iframe?.contentWindow?.postMessage({ __quantArtifact: token, ...payload }, "*");
      };

      try {
        const res = await fetch("/api/chat/artifact-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        const data = (await res.json()) as { text?: string; error?: string };
        if (!res.ok) {
          postBack({ kind: "complete_response", id, error: data.error ?? "Completion failed" });
          return;
        }
        postBack({ kind: "complete_response", id, text: data.text ?? "" });
      } catch (err) {
        postBack({
          kind: "complete_response",
          id,
          error: err instanceof Error ? err.message : "Completion failed",
        });
      }
    },
    [token],
  );

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || typeof data !== "object" || data.__quantArtifact !== token) return;

      if (data.kind === "ready") setLoading(false);
      if (data.kind === "error") {
        setRuntimeError(String(data.message || "Runtime error"));
        setLoading(false);
      }
      if (data.kind === "prompt" && typeof data.prompt === "string") {
        emitAction({ type: "prompt", prompt: data.prompt });
      }
      if (data.kind === "action" && typeof data.action === "string") {
        emitAction({ type: "custom", action: data.action, data: data.data });
      }
      if (data.kind === "complete_request" && typeof data.id === "string" && typeof data.prompt === "string") {
        void handleCompleteRequest(data.id, data.prompt);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [emitAction, handleCompleteRequest, token]);

  useEffect(() => {
    setLoading(true);
    setRuntimeError(null);
    const t = setTimeout(() => setLoading(false), 4000);
    return () => clearTimeout(t);
  }, [runKey, compiledSrcDoc]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([code], { type: isSvg ? "image/svg+xml" : "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quant-artifact.${isSvg ? "svg" : "html"}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [code, isSvg]);

  const frame = (heightPx: number | "full") => (
    <div className="relative h-full w-full bg-[#050508]">
      <iframe
        key={runKey}
        ref={iframeRef}
        srcDoc={compiledSrcDoc}
        sandbox="allow-scripts allow-popups"
        referrerPolicy="no-referrer"
        loading="lazy"
        onLoad={() => setLoading(false)}
        className="h-full w-full border-0"
        style={heightPx === "full" ? undefined : { height: heightPx }}
        title={title}
      />
      {loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#050508]/60">
          <Loader2 className="size-5 animate-spin text-cyan-400" />
        </div>
      ) : null}
      {runtimeError ? (
        <div className="absolute inset-x-3 bottom-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-950/80 px-3 py-2 text-[11px] text-rose-300 backdrop-blur">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span className="font-mono leading-snug">Runtime error: {runtimeError}</span>
        </div>
      ) : null}
    </div>
  );

  const toolbar = (
    <div className="flex items-center gap-1.5">
      <div className="flex rounded-lg border border-zinc-900 bg-zinc-900/60 p-0.5">
        <button
          onClick={() => setActiveTab("preview")}
          className={cn(
            "flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all",
            activeTab === "preview" ? "border border-cyan-500/15 bg-cyan-500/10 text-cyan-400" : "border border-transparent text-zinc-500 hover:text-zinc-300",
          )}
        >
          <Eye className="size-3" />
          <span>Preview</span>
        </button>
        <button
          onClick={() => setActiveTab("code")}
          className={cn(
            "flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all",
            activeTab === "code" ? "border border-cyan-500/15 bg-cyan-500/10 text-cyan-400" : "border border-transparent text-zinc-500 hover:text-zinc-300",
          )}
        >
          <Code className="size-3" />
          <span>Code</span>
        </button>
      </div>

      <IconBtn title="Refresh" onClick={() => setRunKey((k) => k + 1)}>
        <RefreshCw className="size-3" />
      </IconBtn>
      <IconBtn title={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={() => setFullscreen((f) => !f)}>
        {fullscreen ? <Minimize2 className="size-3" /> : <Maximize2 className="size-3" />}
      </IconBtn>
      <IconBtn title="Download" onClick={handleDownload}>
        <Download className="size-3" />
      </IconBtn>
      <IconBtn title="Copy source" onClick={handleCopy}>
        {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
      </IconBtn>
    </div>
  );

  const header = (
    <div className="flex items-center justify-between border-b border-zinc-900/60 bg-zinc-950/80 px-4 py-2.5 shrink-0 select-none">
      <div className="flex items-center gap-2">
        <div className="size-2 animate-pulse rounded-full bg-cyan-500" />
        <span className="max-w-[200px] truncate text-xs font-bold text-zinc-100">{title}</span>
        <span className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-zinc-500">
          {isSvg ? "SVG" : "INTERACTIVE"}
        </span>
      </div>
      {toolbar}
    </div>
  );

  const codePane = (
    <div className="h-full w-full select-text overflow-auto bg-zinc-950/60 p-4 font-mono text-[11px] leading-relaxed text-zinc-400">
      <pre className="whitespace-pre-wrap break-words">{code}</pre>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm p-4 sm:p-8 animate-fade-in">
        <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
          {header}
          <div className="relative min-h-0 flex-1">{activeTab === "preview" ? frame("full") : codePane}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="group my-3 flex w-full flex-col overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950/40 shadow-xl animate-fade-in">
      {header}
      {activeTab === "preview" ? (
        <>
          <div className="relative min-h-0" style={{ height: SIZE_PX[size] }}>
            {frame(SIZE_PX[size])}
          </div>
          <div className="flex items-center justify-between border-t border-zinc-900/60 bg-zinc-950/70 px-3 py-1.5">
            <div className="flex gap-1">
              {(["compact", "default", "tall"] as SizePreset[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={cn(
                    "rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer",
                    size === s ? "bg-zinc-800 text-zinc-200" : "text-zinc-600 hover:text-zinc-400",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-600">sandboxed · interactive</span>
          </div>
        </>
      ) : (
        <div className="h-[460px]">{codePane}</div>
      )}
    </div>
  );
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="cursor-pointer rounded-lg border border-zinc-900 bg-zinc-950 p-1.5 text-zinc-500 transition-all hover:bg-zinc-900 hover:text-zinc-300"
      type="button"
    >
      {children}
    </button>
  );
}
