"use client";

import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/billingsdk-config";
import { Check } from "lucide-react";

export function PricingTableOne({
  plans,
  title,
  description,
  onPlanSelect,
  size = "medium",
  theme = "classic",
  className,
  currentPlanId,
  loadingPlanId,
}: {
  plans: Plan[];
  title: string;
  description: string;
  onPlanSelect?: (planId: string) => void;
  size?: "small" | "medium" | "large";
  theme?: "minimal" | "classic";
  className?: string;
  currentPlanId?: string;
  loadingPlanId?: string | null;
}) {
  const pad = size === "small" ? "p-4" : size === "large" ? "p-8" : "p-6";

  return (
    <section className={cn("w-full", className)}>
      <div className="text-center mb-10 space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">{title}</h1>
        <p className="text-zinc-400 text-sm md:text-base max-w-xl mx-auto">{description}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-6xl mx-auto">
        {plans.map((plan) => {
          const isCurrent = currentPlanId === plan.id;
          const isLoading = loadingPlanId === plan.id;
          const highlighted = plan.highlighted;

          return (
            <article
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-2xl border transition-all",
                theme === "classic" ? "terminal-card-raised" : "terminal-card",
                pad,
                highlighted && "border-blue-500/35 ring-1 ring-blue-500/15",
                !highlighted && "border-[var(--terminal-border)]"
              )}
            >
              {highlighted ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 terminal-badge bg-blue-500/15 text-blue-200 border border-blue-500/25">
                  Most popular
                </span>
              ) : null}

              <div className="mb-5">
                <h2 className="text-lg font-semibold text-white">{plan.name}</h2>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold text-white tracking-tight">{plan.price}</span>
                <span className="text-sm text-zinc-500 ml-2">/{plan.period}</span>
              </div>

              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-zinc-300">
                    <Check className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={plan.id === "free" || isCurrent || isLoading}
                onClick={() => onPlanSelect?.(plan.id)}
                className={cn(
                  "w-full terminal-btn",
                  highlighted || plan.id !== "free" ? "terminal-btn-primary" : "terminal-btn-ghost",
                  (plan.id === "free" || isCurrent) && "opacity-60 cursor-not-allowed"
                )}
              >
                {isLoading ? "Redirecting…" : isCurrent ? "Current plan" : plan.cta}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
