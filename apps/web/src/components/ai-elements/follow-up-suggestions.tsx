"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ParsedInteractiveQuestion } from "@/lib/chat/interactive-question-helper";

export function FollowUpSuggestions({
  question,
  disabled = false,
  onSelect,
  className,
}: {
  question: ParsedInteractiveQuestion | null;
  disabled?: boolean;
  onSelect: (prompt: string) => void;
  className?: string;
}) {
  if (!question?.options?.length) return null;

  return (
    <div className={cn("space-y-2 animate-fade-in", className)}>
      <p className="px-0.5 text-[10px] text-zinc-600">Suggested</p>
      <div className="flex flex-wrap gap-2">
        {question.options.map((option) => (
          <button
            key={`${question.id}-${option.value}`}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(option.value)}
            className={cn(
              "group inline-flex max-w-full items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-left text-xs font-medium transition-all duration-200",
              "border-zinc-800/80 bg-zinc-950/50 text-zinc-300 shadow-sm",
              "hover:border-cyan-500/25 hover:bg-cyan-500/5 hover:text-white",
              "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <span className="truncate">{option.label}</span>
            <ArrowRight
              className="size-3 shrink-0 opacity-40 transition-transform group-hover:translate-x-0.5 group-hover:opacity-70"
              aria-hidden
            />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Clickable chips for the empty Command landing state. */
export function LandingPromptChips({
  suggestions,
  disabled = false,
  onSelect,
  className,
}: {
  suggestions: string[];
  disabled?: boolean;
  onSelect: (prompt: string) => void;
  className?: string;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className={cn("mt-6 w-full max-w-xl text-left", className)}>
      <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500 font-mono">
        Suggested for you
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(suggestion)}
            className={cn(
              "w-full rounded-xl border px-3.5 py-2.5 text-left text-[11px] font-normal leading-snug transition-all duration-200",
              "border-zinc-800/60 bg-zinc-950/30 text-zinc-400",
              "hover:border-zinc-700 hover:bg-zinc-900/50 hover:text-zinc-200",
              "active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
