"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { ArtifactSandboxCard } from "@/components/generative-ui/artifact-sandbox-card";
import { ArtifactSkeleton } from "@/components/generative-ui/artifact-skeleton";
import { GenerativeUiRegistry } from "@/components/generative-ui/registry";
import { GenUiRenderer } from "@/components/generative-ui/genui-renderer";
import { normalizeGenUiPayload } from "@/components/generative-ui/genui-types";
import { parseGenUiPayload } from "@/lib/genui/parse-genui-json";

interface CodeBlockProps {
  language?: string;
  code: string;
}

function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code: ", err);
    }
  };

  return (
    <div className="my-3 rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden text-left">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-900 bg-zinc-900/40">
        <span className="text-xs font-mono text-zinc-400 lowercase">{language || "code"}</span>
        <button
          onClick={handleCopy}
          className="p-1 hover:bg-zinc-900 rounded text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
          type="button"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[13px] font-mono text-zinc-200 leading-normal bg-zinc-950">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const KNOWN_GENUI_TYPES = new Set([
  "section", "grid", "divider", "text", "stat", "metricCard", "sparkline",
  "gauge", "progress", "callout", "badge", "keyValue", "barlist", "table",
  "chart", "component", "actionButton",
]);

/** Does a parsed JSON value plausibly describe a GenUI payload? */
function looksLikeGenui(parsed: unknown): boolean {
  if (Array.isArray(parsed)) {
    return parsed.some((n) => !!n && typeof n === "object" && KNOWN_GENUI_TYPES.has((n as { type?: string }).type ?? ""));
  }
  if (!parsed || typeof parsed !== "object") return false;
  const o = parsed as Record<string, unknown>;
  if (Array.isArray(o.view)) return true;
  if (o.component || o.name) return true;
  return typeof o.type === "string" && KNOWN_GENUI_TYPES.has(o.type);
}

function extractCodeString(children: React.ReactNode): string {
  if (typeof children === "string") return children.replace(/\n$/, "");
  if (Array.isArray(children)) {
    return children
      .map((c) => (typeof c === "string" ? c : ""))
      .join("")
      .replace(/\n$/, "");
  }
  return String(children).replace(/\n$/, "");
}

function GenUiParseError({ raw }: { raw: string }) {
  return (
    <div className="my-2 rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-300">
      Could not render this interface — the model returned invalid JSON. Try asking again or request a simpler layout.
      <details className="mt-1.5">
        <summary className="cursor-pointer text-[10px] text-amber-400/80">Raw payload</summary>
        <pre className="mt-1 max-h-32 overflow-auto font-mono text-[10px] text-zinc-500">{raw.slice(0, 800)}</pre>
      </details>
    </div>
  );
}

/**
 * Try to render a structured block (genui DSL or legacy component JSON).
 * `strict` (used for plain ```json fences) requires the payload to clearly
 * look like GenUI, so ordinary JSON snippets still render as code.
 * Returns null if the string isn't a recognizable structured payload.
 */
function renderStructured(codeString: string, strict: boolean): React.ReactNode | null {
  const result = parseGenUiPayload(codeString);
  if (!result) return null;

  const { payload, salvaged } = result;
  if (strict && !looksLikeGenui(payload)) return null;

  const nodes = normalizeGenUiPayload(payload);
  if (nodes && nodes.length > 0) {
    return (
      <>
        {salvaged ? (
          <p className="mb-1 text-[10px] text-zinc-500">Partial layout recovered from model output.</p>
        ) : null}
        <GenUiRenderer payload={payload} />
      </>
    );
  }

  const obj = payload as Record<string, unknown>;
  const compName = (obj.component || obj.name) as string | undefined;
  if (compName) {
    return <GenerativeUiRegistry name={compName} props={(obj.props as Record<string, unknown>) || obj} />;
  }

  return null;
}

/** Languages whose blocks must NOT be rendered until fully streamed in. */
const DEFERRED_LANGS = new Set(["html", "svg", "xml", "genui"]);

/** Split markdown into alternating prose + fenced genui/html blocks. */
const FENCE_RE = /```(genui|json|html|svg|xml)\s*\n?([\s\S]*?)```/gi;

function renderGenuiFence(body: string, lang: string): React.ReactNode {
  if (lang === "html" || lang === "svg" || (lang === "xml" && body.includes("<svg"))) {
    return (
      <ArtifactSandboxCard
        code={body}
        language={lang}
        title={lang === "svg" ? "Vector Visualisation" : "Interactive Artifact"}
      />
    );
  }

  const structured = renderStructured(body, lang === "json");
  if (structured) return structured;
  if (lang === "genui" || lang === "json") {
    return <GenUiParseError raw={body} />;
  }
  return <CodeBlock language={lang} code={body} />;
}

function MarkdownSegment({ markdown }: { markdown: string }) {
  if (!markdown.trim()) return null;
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
      {markdown}
    </ReactMarkdown>
  );
}

function renderMarkdownWithFences(markdown: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  FENCE_RE.lastIndex = 0;

  while ((match = FENCE_RE.exec(markdown)) !== null) {
    const [full, lang, body] = match;
    const before = markdown.slice(lastIndex, match.index);
    if (before.trim()) {
      nodes.push(<MarkdownSegment key={`md-${lastIndex}`} markdown={before} />);
    }

    const langLower = lang.toLowerCase();

    nodes.push(
      <div key={`fence-${match.index}`} className="w-full">
        {renderGenuiFence(body, langLower)}
      </div>
    );
    lastIndex = match.index + full.length;
  }

  const tail = markdown.slice(lastIndex);
  if (tail.trim()) {
    nodes.push(<MarkdownSegment key={`md-tail-${lastIndex}`} markdown={tail} />);
  }

  return nodes;
}

/**
 * If the markdown ends with an unterminated fenced code block, split it off so
 * we can show a skeleton instead of rendering broken partial HTML / JSON.
 */
function splitTrailingFence(md: string): { safe: string; pendingLang: string | null } {
  const lines = md.split("\n");
  let openIdx = -1;
  let openLang = "";
  let fenceChar = "";
  for (let i = 0; i < lines.length; i++) {
    const m = /^[ \t]*(`{3,}|~{3,})(.*)$/.exec(lines[i]);
    if (!m) continue;
    const marker = m[1][0];
    if (openIdx === -1) {
      openIdx = i;
      openLang = m[2].trim().toLowerCase();
      fenceChar = marker;
    } else if (marker === fenceChar) {
      openIdx = -1;
      openLang = "";
      fenceChar = "";
    }
  }
  if (openIdx === -1) return { safe: md, pendingLang: null };
  return { safe: lines.slice(0, openIdx).join("\n"), pendingLang: openLang };
}

const MD_COMPONENTS = {
  a: ({ node: _n, ...props }: any) => (
    <a
      {...props}
      className="text-[#24ee89] underline underline-offset-2 hover:text-[#1a9d5c] font-medium transition-colors"
      target="_blank"
      rel="noreferrer"
    />
  ),
  code: ({ node: _n, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || "");
    const inline = !className;
    const codeString = extractCodeString(children);

    if (inline) {
      return (
        <code
          {...props}
          className="rounded bg-zinc-800/60 border border-zinc-700/30 px-1.5 py-0.5 text-[0.9em] font-mono text-zinc-200"
        >
          {children}
        </code>
      );
    }

    const lang = match ? match[1] : "";

    // Approach A: sandboxed custom HTML/SVG artifact
    if (lang === "html" || lang === "svg" || (lang === "xml" && codeString.includes("<svg"))) {
      return (
        <ArtifactSandboxCard
          code={codeString}
          language={lang}
          title={lang === "svg" ? "Vector Visualisation" : "Interactive Artifact"}
        />
      );
    }

    // Approach B: declarative Generative-UI engine (preferred) + legacy component JSON.
    // genui fence = liberal; plain json fence = strict (so ordinary JSON stays code).
    if (lang === "genui" || lang === "json") {
      const structured = renderStructured(codeString, lang === "json");
      if (structured) return structured;
      if (lang === "genui") return <GenUiParseError raw={codeString} />;
    }

    return <CodeBlock language={match ? match[1] : undefined} code={codeString} />;
  },
  ul: ({ node: _n, ...props }: any) => (
    <ul {...props} className="list-disc space-y-1.5 pl-5 text-[13.5px] sm:text-sm text-zinc-300 leading-relaxed text-left" />
  ),
  ol: ({ node: _n, ...props }: any) => (
    <ol {...props} className="list-decimal space-y-1.5 pl-5 text-[13.5px] sm:text-sm text-zinc-300 leading-relaxed text-left" />
  ),
  p: ({ node: _n, ...props }: any) => (
    <p {...props} className="mb-2 last:mb-0 leading-relaxed text-[13.5px] sm:text-sm text-zinc-200 text-left" />
  ),
  h1: ({ node: _n, ...props }: any) => (
    <h1 {...props} className="text-lg font-extrabold text-white mt-6 mb-3 tracking-tight text-left" />
  ),
  h2: ({ node: _n, ...props }: any) => (
    <h2 {...props} className="text-base font-bold text-white mt-5 mb-2 tracking-tight text-left" />
  ),
  h3: ({ node: _n, ...props }: any) => (
    <h3 {...props} className="text-sm font-semibold text-white mt-4 mb-2 tracking-tight text-left" />
  ),
  blockquote: ({ node: _n, ...props }: any) => (
    <blockquote {...props} className="pl-4 border-l-2 border-zinc-700 text-zinc-400 italic my-2 text-left" />
  ),
  table: ({ node: _n, ...props }: any) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-zinc-800">
      <table {...props} className="w-full border-collapse text-left text-xs text-zinc-300" />
    </div>
  ),
  thead: ({ node: _n, ...props }: any) => (
    <thead {...props} className="bg-zinc-900/60 text-zinc-200 uppercase tracking-wider font-semibold border-b border-zinc-800" />
  ),
  tbody: ({ node: _n, ...props }: any) => (
    <tbody {...props} className="divide-y divide-zinc-800 bg-zinc-950/20" />
  ),
  tr: ({ node: _n, ...props }: any) => <tr {...props} className="hover:bg-zinc-900/30 transition-colors" />,
  th: ({ node: _n, ...props }: any) => <th {...props} className="px-4 py-3 font-semibold text-zinc-200" />,
  td: ({ node: _n, ...props }: any) => <td {...props} className="px-4 py-3 font-normal text-zinc-300" />,
};

export function MarkdownContent({ markdown, isStreaming = false }: { markdown: string; isStreaming?: boolean }) {
  if (!markdown) return null;

  // While streaming, hold back an unterminated deferred block (html/svg/genui)
  // and show a skeleton instead of rendering broken partial output.
  let safeMarkdown = markdown;
  let pendingKind: "artifact" | "interface" | null = null;

  if (isStreaming) {
    const { safe, pendingLang } = splitTrailingFence(markdown);
    if (pendingLang !== null && DEFERRED_LANGS.has(pendingLang)) {
      safeMarkdown = safe;
      pendingKind = pendingLang === "genui" ? "interface" : "artifact";
    }
  }

  return (
    <div className="w-full space-y-3">
      {renderMarkdownWithFences(safeMarkdown)}
      {pendingKind ? <ArtifactSkeleton kind={pendingKind === "artifact" ? "artifact" : "interface"} /> : null}
    </div>
  );
}
