"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function MarkdownContent({ markdown }: { markdown: string }) {
  if (!markdown) return null;

  return (
    <div className="w-full space-y-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _n, ...props }) => (
            <a
              {...props}
              className="text-[#24ee89] underline underline-offset-2 hover:text-[#1a9d5c] font-medium transition-colors"
              target="_blank"
              rel="noreferrer"
            />
          ),
          code: ({ node: _n, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || "");
            const inline = !className;
            const codeString = String(children).replace(/\n$/, "");

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

            return (
              <CodeBlock
                language={match ? match[1] : undefined}
                code={codeString}
              />
            );
          },
          ul: ({ node: _n, ...props }) => (
            <ul {...props} className="list-disc space-y-1.5 pl-5 text-[13.5px] sm:text-sm text-zinc-300 leading-relaxed text-left" />
          ),
          ol: ({ node: _n, ...props }) => (
            <ol {...props} className="list-decimal space-y-1.5 pl-5 text-[13.5px] sm:text-sm text-zinc-300 leading-relaxed text-left" />
          ),
          p: ({ node: _n, ...props }) => (
            <p {...props} className="mb-2 last:mb-0 leading-relaxed text-[13.5px] sm:text-sm text-zinc-200 text-left" />
          ),
          h1: ({ node: _n, ...props }) => (
            <h1 {...props} className="text-lg font-extrabold text-white mt-6 mb-3 tracking-tight text-left" />
          ),
          h2: ({ node: _n, ...props }) => (
            <h2 {...props} className="text-base font-bold text-white mt-5 mb-2 tracking-tight text-left" />
          ),
          h3: ({ node: _n, ...props }) => (
            <h3 {...props} className="text-sm font-semibold text-white mt-4 mb-2 tracking-tight text-left" />
          ),
          blockquote: ({ node: _n, ...props }) => (
            <blockquote {...props} className="pl-4 border-l-2 border-zinc-700 text-zinc-400 italic my-2 text-left" />
          ),
          table: ({ node: _n, ...props }) => (
            <div className="my-4 overflow-x-auto rounded-xl border border-zinc-800">
              <table {...props} className="w-full border-collapse text-left text-xs text-zinc-300" />
            </div>
          ),
          thead: ({ node: _n, ...props }) => (
            <thead {...props} className="bg-zinc-900/60 text-zinc-200 uppercase tracking-wider font-semibold border-b border-zinc-800" />
          ),
          tbody: ({ node: _n, ...props }) => (
            <tbody {...props} className="divide-y divide-zinc-800 bg-zinc-950/20" />
          ),
          tr: ({ node: _n, ...props }) => (
            <tr {...props} className="hover:bg-zinc-900/30 transition-colors" />
          ),
          th: ({ node: _n, ...props }) => (
            <th {...props} className="px-4 py-3 font-semibold text-zinc-200" />
          ),
          td: ({ node: _n, ...props }) => (
            <td {...props} className="px-4 py-3 font-normal text-zinc-300" />
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
