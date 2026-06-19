"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function useTypingPlaceholder(suggestions: string[], enabled: boolean) {
  const [text, setText] = useState("");
  const [index, setIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!enabled || suggestions.length === 0) {
      setText("");
      return;
    }

    const full = suggestions[index] ?? "";
    const tick = deleting ? 26 : 42;

    const timer = window.setTimeout(() => {
      if (!deleting) {
        if (text.length < full.length) {
          setText(full.slice(0, text.length + 1));
        } else {
          window.setTimeout(() => setDeleting(true), 2200);
        }
      } else if (text.length > 0) {
        setText(text.slice(0, -1));
      } else {
        setDeleting(false);
        setIndex((i) => (i + 1) % suggestions.length);
      }
    }, tick);

    return () => window.clearTimeout(timer);
  }, [text, deleting, index, enabled, suggestions]);

  useEffect(() => {
    if (!enabled) {
      setText("");
      setDeleting(false);
      setIndex(0);
    }
  }, [enabled]);

  return text;
}

export function TypingPlaceholderOverlay({
  suggestions,
  visible,
  className,
}: {
  suggestions: string[];
  visible: boolean;
  className?: string;
}) {
  const text = useTypingPlaceholder(suggestions, visible);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center text-[14px] leading-none text-zinc-500",
        className,
      )}
      aria-hidden
    >
      <span className="truncate">{text}</span>
      <span className="ml-0.5 inline-block h-3.5 w-[2px] shrink-0 animate-pulse bg-blue-400/80" />
    </div>
  );
}
