"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { chatDraftPath } from "@/lib/routes";
import { ArrowRight, Lock, Sparkles } from "lucide-react";
import { plans } from "@/lib/billingsdk-config";
import { LandingPixelBackground } from "@/components/landing/landing-pixel-background";
import { LandingBlueGlow } from "@/components/landing/landing-blue-glow";
import { LandingHeroBackground } from "@/components/landing/landing-hero-background";
import { LandingGradientText } from "@/components/landing/landing-ui";
import { cn } from "@/lib/utils";

const managedPlan = plans.find((p) => p.id === "premium");
const UPGRADE_PRIMARY_BUTTON =
  "relative inline-flex items-center justify-center overflow-hidden rounded-full border border-[#5988ff] bg-[#316bff] px-5 py-2 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(49,107,255,0.32)] transition-all hover:bg-[#3f76ff] hover:shadow-[0_10px_24px_rgba(49,107,255,0.4)]";
const UPGRADE_SECONDARY_BUTTON =
  "inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.03] px-5 py-2 text-sm font-semibold text-white/85 backdrop-blur-sm transition-all hover:border-[#5988ff]/70 hover:bg-[#316bff]/10 hover:text-white";
const MANAGED_WELCOME_SEEN_KEY = "terabits:managed-account-welcome-seen";

export function PremiumUpgradeGate({
  currentPlan = "free",
}: {
  currentPlan?: string;
}) {
  const [screen, setScreen] = useState<"checking" | "welcome" | "subscribe">("checking");

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem(MANAGED_WELCOME_SEEN_KEY) === "1";
      setScreen(seen ? "subscribe" : "welcome");
    } catch {
      setScreen("subscribe");
    }
  }, []);

  const continueToSubscribe = () => {
    try {
      window.localStorage.setItem(MANAGED_WELCOME_SEEN_KEY, "1");
    } catch {
      // Non-critical: showing the intro again is better than blocking navigation.
    }
    setScreen("subscribe");
  };

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden bg-[#070707] px-4 py-12">
      {screen === "welcome" ? (
        <div className="pointer-events-none absolute inset-0 z-0">
          <LandingHeroBackground />
        </div>
      ) : (
        <>
          <LandingPixelBackground />
          <LandingBlueGlow />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(49,107,255,0.24),rgba(7,7,14,0)_68%)]" />
        </>
      )}
      <div className="pointer-events-none absolute inset-0 ring-1 ring-white/5 ring-inset" />

      {screen === "checking" ? (
        <div className="relative z-10 flex w-full max-w-lg flex-col items-center gap-4">
          <div className="h-14 w-14 animate-pulse rounded-full border border-[#5988ff]/40 bg-[#316bff]/10" />
          <div className="h-7 w-72 animate-pulse rounded-full bg-white/[0.06]" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded-full bg-white/[0.04]" />
        </div>
      ) : screen === "welcome" ? (
        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center px-4 py-8 sm:px-6 sm:py-12 md:py-16">
          <div className="mx-auto max-w-3xl text-center">
          <div className="animate-fade-slide-in-1 mb-5 inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-2 backdrop-blur-md sm:mb-6 sm:gap-3 sm:border-white/15 sm:bg-white/5 sm:px-3.5">
            <span className="inline-flex items-center rounded-full border border-[#316bff]/35 bg-[#316bff]/20 px-2 py-0.5 text-xs font-semibold text-cyan-200">
              Managed
            </span>
            <span className="text-sm font-semibold text-white sm:font-medium sm:text-white/90">
              AI-managed trading and investing
            </span>
          </div>

          <h1 className="animate-fade-slide-in-2 font-serif text-[clamp(2.75rem,11vw,4.5rem)] font-normal leading-[1.06] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            Let AI manage your
            <br className="hidden sm:block" />
            trading and investing
          </h1>

          <p className="animate-fade-slide-in-3 mx-auto mt-6 max-w-2xl text-base text-white/92 sm:text-lg sm:text-white/80">
            Put your portfolio on autopilot with an AI-managed account that can monitor markets,
            allocate capital, and handle execution workflows around your risk profile.
          </p>

          <div className="animate-fade-slide-in-4 mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <button
              type="button"
              onClick={continueToSubscribe}
              className="terminal-btn terminal-btn-primary px-5 py-3 text-sm"
            >
              Try AI managed investments
              <ArrowRight className="size-4" />
            </button>
            <Link
              href={chatDraftPath()}
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-white transition hover:text-white sm:text-white/90"
            >
              Back to Chat
            </Link>
          </div>
          </div>

          <div className="animate-fade-slide-in-3 mt-12 grid w-full max-w-5xl grid-cols-1 gap-3 text-left sm:mt-16 sm:grid-cols-3">
            {[
              "Market monitoring",
              "Portfolio allocation",
              "Automated trade execution",
            ].map((item) => (
              <div
                key={item}
                className="rounded-[14px] border border-white bg-white/[0.02] p-4 shadow-[0_0_30px_rgba(49,107,255,0.08)]"
              >
                <span className="mb-3 block size-1.5 rounded-full bg-[#8fb0ff]" />
                <p className="text-sm font-semibold leading-snug text-white">{item}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-col items-center text-center">
        <div className="mb-6 flex size-16 items-center justify-center rounded-[10px] border border-[#5988ff]/40 bg-[#316bff]/10 shadow-[0_0_30px_rgba(49,107,255,0.18)]">
          <Lock className="size-7 text-[#8fb0ff]" strokeWidth={1.75} />
        </div>

        <h1 className="mb-3 text-2xl font-bold tracking-tight text-white md:text-3xl">
          <LandingGradientText>Managed Account requires Managed</LandingGradientText>
        </h1>

        <p className="mb-2 max-w-md text-sm leading-relaxed text-zinc-400">
          {currentPlan === "pro"
            ? "You're on Terminal ($30/mo) — great for signals and analytics. AI managed investing, portfolio allocation, and automated execution require the Managed plan."
            : "Subscribe to Managed ($50/mo) to try AI managed investments, portfolio automation, and execution workflows."}
        </p>

        <div className="relative mb-8 mt-6 w-full overflow-hidden rounded-[14px] border border-white bg-white/[0.02] p-5 text-left shadow-[0_0_40px_rgba(49,107,255,0.08)]">
          <div className="pointer-events-none absolute -bottom-16 left-1/2 h-28 w-[80%] -translate-x-1/2 rounded-full bg-[#316bff]/20 blur-3xl" />
          <div className="relative">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="size-4 text-[#8fb0ff]" />
              <span className="text-sm font-semibold text-white">
                {managedPlan?.name ?? "Managed"} — {managedPlan?.price ?? "$50"}/mo
              </span>
            </div>
            <ul className="space-y-2">
              {(managedPlan?.features ?? []).map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-zinc-400">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[#8fb0ff]" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/pricing?upgrade=managed"
            className={UPGRADE_PRIMARY_BUTTON}
          >
            Subscribe for $50/mo
          </Link>
          <Link
            href={chatDraftPath()}
            className={cn(UPGRADE_SECONDARY_BUTTON, "min-w-[132px]")}
          >
            Back to Chat
          </Link>
        </div>
      </div>
      )}
    </div>
  );
}
