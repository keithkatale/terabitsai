"use client";

import * as React from "react";
import { useState } from "react";
import { Check, CornerDownLeft, Terminal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ParsedInteractiveQuestion } from "@/lib/chat/interactive-question-helper";

export function InteractiveQuestionForm({
  question,
  onSubmit,
  onDismiss,
}: {
  question: ParsedInteractiveQuestion;
  onSubmit: (response: string) => void;
  onDismiss: () => void;
}) {
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [inputText, setInputText] = useState("");

  const handleToggleSelect = (value: string) => {
    if (question.type === "single-select") {
      setSelectedValues((prev) => (prev.includes(value) ? [] : [value]));
    } else {
      setSelectedValues((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
      );
    }
  };

  const handleSubmit = () => {
    if (question.type === "input") {
      if (!inputText.trim()) return;
      onSubmit(inputText.trim());
      return;
    }
    if (selectedValues.length === 0) return;
    onSubmit(selectedValues.join(", "));
  };

  const canSubmit =
    question.type === "input" ? inputText.trim().length > 0 : selectedValues.length > 0;

  return (
    <div className="w-full animate-fade-in rounded-2xl border border-cyan-500/20 bg-zinc-950/95 p-3 shadow-xl shadow-black/40 backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="rounded bg-cyan-500/10 p-0.5 text-cyan-400">
            <Terminal className="size-3" aria-hidden />
          </span>
          <h4 className="truncate text-[11px] font-bold uppercase tracking-wide text-zinc-100 font-mono">
            {question.title}
          </h4>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-zinc-500 transition-colors hover:text-zinc-200"
          title="Use standard chat input"
          aria-label="Dismiss question"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {question.description ? (
        <p className="mb-2 rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-2.5 py-2 text-[11px] leading-relaxed text-zinc-400">
          {question.description}
        </p>
      ) : null}

      <div className="mb-2.5 space-y-1.5">
        {question.type === "input" ? (
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder={question.placeholder || "Type your answer…"}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
            autoFocus
          />
        ) : (
          <div className="grid grid-cols-1 gap-1.5">
            {question.options.map((option, idx) => {
              const isSelected = selectedValues.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleToggleSelect(option.value)}
                  className={cn(
                    "flex w-full items-center rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-all duration-200 active:scale-[0.995]",
                    isSelected
                      ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                      : "border-zinc-800/60 bg-zinc-900/30 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900/60",
                  )}
                >
                  <span className="mr-2 flex size-4 shrink-0 items-center justify-center rounded bg-zinc-800 text-[9px] font-bold text-zinc-400">
                    {idx + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {question.type === "single-select" ? (
                    <span
                      className={cn(
                        "ml-2 flex size-3.5 shrink-0 items-center justify-center rounded-full border",
                        isSelected ? "border-cyan-400 bg-cyan-400" : "border-zinc-600",
                      )}
                    >
                      {isSelected ? <span className="size-1.5 rounded-full bg-zinc-950" /> : null}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "ml-2 flex size-3.5 shrink-0 items-center justify-center rounded border",
                        isSelected ? "border-cyan-400 bg-cyan-400 text-zinc-950" : "border-zinc-600",
                      )}
                    >
                      {isSelected ? <Check className="size-2.5" strokeWidth={3} /> : null}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-zinc-800/60 pt-2">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded px-2 py-1 text-[10px] font-bold text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-300"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg px-3 py-1 text-[10px] font-bold transition-all active:scale-95",
            canSubmit
              ? "bg-cyan-500 text-zinc-950 hover:bg-cyan-400"
              : "cursor-not-allowed bg-zinc-800 text-zinc-600",
          )}
        >
          Submit
          <CornerDownLeft className="size-3" aria-hidden />
        </button>
      </div>
    </div>
  );
}
