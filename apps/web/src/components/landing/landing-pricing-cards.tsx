"use client";

import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/billingsdk-config";
import { LandingGradientText } from "./landing-ui";

export function LandingPricingCards({
  plans,
  currentPlanId,
  loadingPlanId,
  onPlanSelect,
}: {
  plans: Plan[];
  currentPlanId?: string;
  loadingPlanId?: string | null;
  onPlanSelect?: (planId: string) => void;
}) {
  return (
    <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-3">
      {plans.map((plan) => {
        const isCurrent = currentPlanId === plan.id;
        const isLoading = loadingPlanId === plan.id;
        const highlighted = plan.highlighted;
        const disabled = plan.id === "free" || isCurrent || isLoading;

        return (
          <article
            key={plan.id}
            className={cn(
              "landing-pricing-card relative flex flex-col p-6 md:p-8",
              highlighted && "landing-pricing-card--highlighted",
            )}
          >
            {highlighted ? (
              <span className="landing-pricing-badge absolute -top-3 left-1/2 -translate-x-1/2">
                Most popular
              </span>
            ) : null}

            <div className="mb-5">
              <LandingGradientText
                as="h2"
                className="text-xl font-semibold tracking-[-0.02em] md:text-2xl"
              >
                {plan.name}
              </LandingGradientText>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{plan.description}</p>
            </div>

            <div className="mb-6 flex items-baseline gap-2">
              <span className="font-serif text-4xl font-normal tracking-tight text-white md:text-5xl">
                {plan.price}
              </span>
              <span className="text-sm text-white/45">/{plan.period}</span>
            </div>

            <ul className="mb-8 flex flex-1 flex-col gap-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-white/80">
                  <Check className="mt-0.5 size-4 shrink-0 text-[#5988ff]" strokeWidth={2.5} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              disabled={disabled}
              onClick={() => onPlanSelect?.(plan.id)}
              className={cn(
                "terminal-btn w-full py-3 text-sm",
                highlighted || plan.id !== "free"
                  ? "terminal-btn-primary"
                  : "terminal-btn-ghost",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Redirecting…
                </span>
              ) : isCurrent ? (
                "Current plan"
              ) : (
                plan.cta
              )}
            </button>
          </article>
        );
      })}
    </div>
  );
}
