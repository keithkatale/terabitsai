"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ArrowUpIcon, RefreshCw } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export interface PromptInputMessage {
  text: string;
}

interface PromptInputProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, "onSubmit"> {
  onSubmit: (message: PromptInputMessage) => void;
}

export function PromptInput({ onSubmit, className, children, ...props }: PromptInputProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const text = formData.get("prompt")?.toString() || "";
    onSubmit({ text });
  };

  return (
    <form className={cn("relative w-full", className)} onSubmit={handleSubmit} {...props}>
      {children}
    </form>
  );
}

interface PromptInputTextareaProps extends React.ComponentProps<typeof Textarea> {
  minHeight?: number;
  maxHeight?: number;
}

export function PromptInputTextarea({
  className,
  value,
  onChange,
  onKeyDown,
  ...props
}: PromptInputTextareaProps) {
  return (
    <Textarea
      name="prompt"
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      className={cn(
        "w-full px-4 py-3 resize-none bg-transparent border-none text-white text-sm focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-neutral-500 placeholder:text-sm min-h-[60px]",
        className
      )}
      style={{ overflow: "hidden" }}
      {...props}
    />
  );
}

interface PromptInputSubmitProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  status: "streaming" | "ready";
}

export function PromptInputSubmit({ status, className, disabled, ...props }: PromptInputSubmitProps) {
  return (
    <button
      type="submit"
      disabled={disabled || status === "streaming"}
      className={cn(
        "p-2.5 rounded-full text-sm transition-colors border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800 flex items-center justify-center gap-1",
        disabled
          ? "text-zinc-500 cursor-not-allowed border-zinc-800"
          : "bg-white text-black border-white hover:bg-zinc-200",
        className
      )}
      {...props}
    >
      {status === "streaming" ? (
        <RefreshCw className="w-4 h-4 animate-spin text-zinc-400" />
      ) : (
        <ArrowUpIcon
          className={cn(
            "w-4 h-4",
            disabled ? "text-zinc-500" : "text-black"
          )}
        />
      )}
      <span className="sr-only">Send</span>
    </button>
  );
}
