"use client";

import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";
import { plans } from "@/lib/billingsdk-config";
import { LandingPixelBackground } from "@/components/landing/landing-pixel-background";
import { LandingBlueGlow } from "@/components/landing/landing-blue-glow";
import { LandingGradientText } from "@/components/landing/landing-ui";

const managedPlan = plans.find((p) => p.id === "premium");

export function PremiumUpgradeGate({
  currentPlan = "free",
}: {
  currentPlan?: string;
}) {
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden px-4 py-12">
      <LandingPixelBackground />
      <LandingBlueGlow />

      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-col items-center text-center">
        <div className="mb-6 flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
          <Lock className="size-7 text-cyan-400" strokeWidth={1.75} />
        </div>

        <h1 className="mb-3 text-2xl font-bold tracking-tight text-white md:text-3xl">
          <LandingGradientText>Wallet requires Managed</LandingGradientText>
        </h1>

        <p className="mb-2 text-sm leading-relaxed text-zinc-400">
          {currentPlan === "pro"
            ? "You're on Terminal ($30/mo) — great for signals and analytics. Managed portfolio, automated execution, and the Wallet tab require the Managed plan."
            : "Managed accounts, portfolio automation, and the Wallet tab are available on the Managed plan ($50/mo)."}
        </p>

        <div className="mb-8 mt-6 w-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="size-4 text-cyan-400" />
            <span className="text-sm font-semibold text-white">
              {managedPlan?.name ?? "Managed"} — {managedPlan?.price ?? "$50"}/mo
            </span>
          </div>
          <ul className="space-y-2">
            {(managedPlan?.features ?? []).map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-zinc-400">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-cyan-400" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/pricing?upgrade=managed"
            className="rounded-xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-cyan-400"
          >
            Upgrade to Managed
          </Link>
          <Link
            href="/app/chat"
            className="rounded-xl border border-white/10 px-6 py-3 text-sm font-semibold text-zinc-300 transition-colors hover:bg-white/[0.05]"
          >
            Back to Chat
          </Link>
        </div>
      </div>
    </div>
  );
}
