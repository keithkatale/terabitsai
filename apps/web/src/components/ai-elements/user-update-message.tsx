"use client";

import { cn } from "@/lib/utils";

type UserUpdateMessageProps = {
  updates: Array<{ id: string; text: string }>;
  isStreaming: boolean;
  hasFinalText: boolean;
};

/** Temporary user-facing updates that collapse when final response arrives. */
export function UserUpdateMessage({ updates, isStreaming, hasFinalText }: UserUpdateMessageProps) {
  if (updates.length === 0) return null;

  // Hide all updates when final text arrives
  if (hasFinalText && !isStreaming) return null;

  return (
    <div className="space-y-2 animate-fade-in">
      {updates.map((update) => (
        <div
          key={update.id}
          className={cn(
            "rounded-lg border px-3 py-2.5 text-sm leading-relaxed",
            "border-cyan-500/20 bg-cyan-500/[0.08] text-cyan-100/90",
            "shadow-[inset_0_1px_0_rgba(34,211,238,0.1)]",
            "animate-fade-in",
          )}
        >
          {update.text}
        </div>
      ))}
    </div>
  );
}
