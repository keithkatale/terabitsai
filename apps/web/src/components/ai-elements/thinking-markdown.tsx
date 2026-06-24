"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const cotComponents = {
  p: ({ node: _n, ...props }: any) => (
    <p {...props} className="mb-1.5 last:mb-0 leading-relaxed text-[11px] text-zinc-400" />
  ),
  strong: ({ node: _n, ...props }: any) => (
    <strong {...props} className="font-semibold text-zinc-300" />
  ),
  em: ({ node: _n, ...props }: any) => (
    <em {...props} className="italic text-zinc-400" />
  ),
  ul: ({ node: _n, ...props }: any) => (
    <ul {...props} className="mb-1.5 list-disc space-y-0.5 pl-4 text-[11px] text-zinc-400" />
  ),
  ol: ({ node: _n, ...props }: any) => (
    <ol {...props} className="mb-1.5 list-decimal space-y-0.5 pl-4 text-[11px] text-zinc-400" />
  ),
  li: ({ node: _n, ...props }: any) => (
    <li {...props} className="leading-relaxed" />
  ),
  h1: ({ node: _n, ...props }: any) => (
    <h1 {...props} className="mb-1 text-[12px] font-bold text-zinc-300" />
  ),
  h2: ({ node: _n, ...props }: any) => (
    <h2 {...props} className="mb-1 text-[11px] font-semibold text-zinc-300" />
  ),
  h3: ({ node: _n, ...props }: any) => (
    <h3 {...props} className="mb-1 text-[11px] font-medium text-zinc-300" />
  ),
  code: ({ node: _n, className, children, ...props }: any) => {
    const inline = !className;
    if (inline) {
      return (
        <code
          {...props}
          className="rounded bg-zinc-800/60 px-1 py-0.5 font-mono text-[10px] text-zinc-300"
        >
          {children}
        </code>
      );
    }
    return (
      <code {...props} className={cn("font-mono text-[10px] text-zinc-300", className)}>
        {children}
      </code>
    );
  },
};

export function ThinkingMarkdown({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) {
  if (!markdown.trim()) return null;

  return (
    <div className={cn("max-h-40 overflow-y-auto text-left", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={cotComponents}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
