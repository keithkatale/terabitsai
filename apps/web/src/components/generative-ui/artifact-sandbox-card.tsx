"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Code, Eye, Play, ShieldAlert, Copy, Check } from "lucide-react";

interface ArtifactSandboxCardProps {
  code: string;
  language?: string;
  title?: string;
}

export function ArtifactSandboxCard({ code, language = "html", title = "Sandboxed Sandbox Artifact" }: ArtifactSandboxCardProps) {
  const [activeTab, setActiveTab] = React.useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [iframeId] = useState(() => `iframe-${Math.random().toString(36).substr(2, 9)}`);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Auto-detect code blocks that might contain just HTML vs SVG or complete app
  const isSvg = code.trim().startsWith("<svg") || (code.trim().startsWith("<?xml") && code.includes("<svg"));
  
  // Wrap raw SVGs in HTML page with dark background centering to render beautifully
  const compiledSrcDoc = React.useMemo(() => {
    if (isSvg) {
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                margin: 0;
                padding: 16px;
                background-color: #050508;
                color: #e4e4e7;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                box-sizing: border-box;
                font-family: system-ui, -apple-system, sans-serif;
                overflow: hidden;
              }
              svg {
                max-width: 100%;
                max-height: 100%;
                filter: drop-shadow(0 10px 30px rgba(99, 102, 241, 0.15));
              }
            </style>
          </head>
          <body>
            ${code}
          </body>
        </html>
      `;
    }

    // Regular HTML/CSS/JS page
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              margin: 0;
              padding: 16px;
              background-color: #050508;
              color: #e4e4e7;
              font-family: system-ui, -apple-system, sans-serif;
              box-sizing: border-box;
            }
            * {
              box-sizing: border-box;
            }
            ::-webkit-scrollbar {
              width: 6px;
              height: 6px;
            }
            ::-webkit-scrollbar-track {
              background: #09090b;
            }
            ::-webkit-scrollbar-thumb {
              background: #27272a;
              border-radius: 9999px;
            }
            ::-webkit-scrollbar-thumb:hover {
              background: #3f3f46;
            }
          </style>
        </head>
        <body>
          ${code}
        </body>
      </html>
    `;
  }, [code, isSvg]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full bg-zinc-950/40 border border-zinc-900 rounded-2xl overflow-hidden shadow-xl animate-fade-in group flex flex-col h-[400px]">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-900/60 bg-zinc-950/80 shrink-0 select-none">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-xs font-bold text-zinc-100 truncate max-w-[220px]">{title}</span>
          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-500 uppercase tracking-wide">
            {isSvg ? "SVG INFOGRAPHIC" : "SANDBOXED HTML"}
          </span>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5">
          <div className="flex bg-zinc-900/60 p-0.5 rounded-lg border border-zinc-900">
            <button
              onClick={() => setActiveTab("preview")}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer",
                activeTab === "preview"
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/15"
                  : "bg-transparent border border-transparent text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Eye className="size-3" />
              <span>Preview</span>
            </button>
            <button
              onClick={() => setActiveTab("code")}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer",
                activeTab === "code"
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/15"
                  : "bg-transparent border border-transparent text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Code className="size-3" />
              <span>Code</span>
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg border border-zinc-900 bg-zinc-950 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-all cursor-pointer"
            title="Copy Source Code"
          >
            {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
          </button>
        </div>
      </div>

      {/* Frame Content */}
      <div className="flex-1 relative min-h-0 bg-[#050508]/40">
        {activeTab === "preview" ? (
          <div className="absolute inset-0 w-full h-full p-0.5 bg-[#050508]/25">
            <iframe
              ref={iframeRef}
              id={iframeId}
              srcDoc={compiledSrcDoc}
              sandbox="allow-scripts"
              className="w-full h-full border-0 rounded-b-xl"
              title={title}
            />
            
            {/* Safety Sandbox Badge Overlay */}
            <div className="absolute bottom-3 right-3 px-2 py-0.5 bg-zinc-950/80 backdrop-blur border border-zinc-900 text-zinc-500 text-[8px] font-mono rounded-md pointer-events-none tracking-widest uppercase shadow-md leading-none flex items-center gap-1">
              <span>SANDBOXED SECURITY ISOLATED</span>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 w-full h-full overflow-auto p-4 font-mono text-[11px] leading-relaxed text-zinc-400 bg-zinc-950/60 select-text">
            <pre className="whitespace-pre-wrap word-break-all">{code}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
