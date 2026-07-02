"use client";

import { cn } from "@/lib/utils";
import { useCopilotGreeting } from "@/hooks/use-copilot-greeting";
import type { User } from "@supabase/supabase-js";

function firstNameFromUser(user: User | null | undefined): string {
  const fullName = user?.user_metadata?.full_name;
  const name = user?.user_metadata?.name;
  const metaName =
    (typeof fullName === "string" && fullName.trim() ? fullName : null) ||
    (typeof name === "string" && name.trim() ? name : null);
  if (metaName) {
    return metaName.trim().split(/\s+/)[0] ?? "there";
  }
  const email = user?.email;
  if (email) {
    const local = email.split("@")[0] ?? "";
    const token = local.split(/[._-]/)[0];
    if (token) return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
  }
  return "there";
}

function PromptSkeleton({ delayClass }: { delayClass: string }) {
  return (
    <div
      className={cn(
        "h-10 w-full rounded-2xl border border-white/[0.03] bg-white/[0.02]",
        delayClass,
      )}
    />
  );
}

export function CopilotGreetingPanel({
  user,
  focusSymbol,
  disabled = false,
  onSelectPrompt,
  className,
}: {
  user?: User | null;
  focusSymbol: string;
  disabled?: boolean;
  onSelectPrompt: (prompt: string) => void;
  className?: string;
}) {
  const firstName = firstNameFromUser(user);
  const { data, loading, animationKey } = useCopilotGreeting(focusSymbol);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col justify-end px-4 pb-[7.75rem] pt-4 sm:px-5",
        className,
      )}
    >
      <div key={`greeting-${animationKey}`} className="w-full max-w-sm text-left">
        <p className="animate-fade-slide-in-1 text-lg font-medium text-[#7c8fd4] sm:text-xl">
          Hello, {firstName}
        </p>
        {loading ? (
          <>
            <div className="animate-fade-slide-in-2 mt-3 h-7 w-full max-w-[220px] rounded-md bg-white/[0.03]" />
            <div className="mt-6 flex flex-col gap-2">
              <PromptSkeleton delayClass="animate-fade-slide-in-2" />
              <PromptSkeleton delayClass="animate-fade-slide-in-3" />
              <div className="h-10 w-full rounded-2xl border border-white/[0.03] bg-white/[0.02] animate-fade-in [animation-delay:300ms]" />
            </div>
          </>
        ) : (
          <>
            <h2 className="animate-fade-slide-in-2 mt-2 text-xl font-normal leading-snug tracking-tight text-white sm:text-2xl">
              {data?.headline ?? "How can I help you today?"}
            </h2>
            {data?.symbol ? (
              <p className="animate-fade-slide-in-2 mt-2 text-[11px] text-zinc-600">
                Based on a quick read of {data.displayName ?? data.symbol}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col gap-2">
              {(data?.prompts ?? []).map((prompt, index) => (
                <button
                  key={`${animationKey}-${prompt}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectPrompt(prompt)}
                  className={cn(
                    "w-full rounded-2xl border border-white/[0.04] bg-white/[0.025] px-4 py-3 text-left text-[13px] font-normal leading-snug text-zinc-500 transition-all",
                    "hover:border-white/[0.07] hover:bg-white/[0.04] hover:text-zinc-300",
                    "active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50",
                    index === 0 && "animate-fade-slide-in-2",
                    index === 1 && "animate-fade-slide-in-3",
                    index === 2 && "animate-fade-in [animation-delay:300ms]",
                  )}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
