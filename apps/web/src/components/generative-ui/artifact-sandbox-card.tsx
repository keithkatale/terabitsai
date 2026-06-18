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

interface ArtifactSandboxCardProps {
  code: string;
  language?: string;
  title?: string;
}

type SizePreset = "compact" | "default" | "tall";
const SIZE_PX: Record<SizePreset, number> = { compact: 320, default: 460, tall: 680 };

export function ArtifactSandboxCard({ code, language = "html", title = "Interactive Artifact" }: ArtifactSandboxCardProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [size, setSize] = useState<SizePreset>("default");
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Unique token so we only react to messages from THIS sandboxed frame.
  const token = React.useMemo(() => `qa_${Math.random().toString(36).slice(2, 11)}`, []);

  const isSvg = code.trim().startsWith("<svg") || (code.trim().startsWith("<?xml") && code.includes("<svg"));

  // Error/ready bridge injected into the sandbox. The frame is sandboxed
  // (allow-scripts only, origin "null"), so it talks back via postMessage.
  const bridgeScript = `
    <script>
      (function () {
        var T = ${JSON.stringify(token)};
        function send(payload) { try { parent.postMessage(Object.assign({ __quantArtifact: T }, payload), "*"); } catch (e) {} }
        window.addEventListener("error", function (e) {
          send({ kind: "error", message: (e && e.message) ? e.message : "Script error" });
        });
        window.addEventListener("unhandledrejection", function (e) {
          var r = e && e.reason;
          send({ kind: "error", message: r ? (r.message || String(r)) : "Unhandled promise rejection" });
        });
        window.addEventListener("DOMContentLoaded", function () { send({ kind: "ready" }); });
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
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #09090b; }
        ::-webkit-scrollbar-thumb { background: #27272a; border-radius: 9999px; }
        ::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
      </style>`;
    return `<!DOCTYPE html><html><head>${head}</head><body>${code}</body></html>`;
    // bridgeScript depends only on token (stable); code/isSvg drive recompiles.
  }, [code, isSvg, bridgeScript]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || typeof data !== "object" || data.__quantArtifact !== token) return;
      if (data.kind === "ready") setLoading(false);
      if (data.kind === "error") {
        setRuntimeError(String(data.message || "Runtime error"));
        setLoading(false);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [token]);

  // Reset state whenever we (re)mount the frame.
  useEffect(() => {
    setLoading(true);
    setRuntimeError(null);
    const t = setTimeout(() => setLoading(false), 4000); // safety: drop spinner even if no 'ready'
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
          <Loader2 className="size-5 animate-spin text-indigo-400" />
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
            activeTab === "preview" ? "border border-indigo-500/15 bg-indigo-500/10 text-indigo-400" : "border border-transparent text-zinc-500 hover:text-zinc-300",
          )}
        >
          <Eye className="size-3" />
          <span>Preview</span>
        </button>
        <button
          onClick={() => setActiveTab("code")}
          className={cn(
            "flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all",
            activeTab === "code" ? "border border-indigo-500/15 bg-indigo-500/10 text-indigo-400" : "border border-transparent text-zinc-500 hover:text-zinc-300",
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
        <div className="size-2 animate-pulse rounded-full bg-indigo-500" />
        <span className="max-w-[200px] truncate text-xs font-bold text-zinc-100">{title}</span>
        <span className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-zinc-500">
          {isSvg ? "SVG" : "SANDBOXED HTML"}
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
            <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-600">sandboxed · isolated</span>
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
