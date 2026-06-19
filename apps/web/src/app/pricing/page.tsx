"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PricingTableOne } from "@/components/billingsdk/pricing-table-one";
import { plans } from "@/lib/billingsdk-config";
import { useAccount } from "@/hooks/use-account";
import { BrandMark } from "@/components/ui/brand-mark";

export default function PricingPage() {
  const { user } = useAccount();
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/subscription/status")
      .then((r) => r.json())
      .then((d) => {
        if (d?.plan) setCurrentPlan(d.plan);
      })
      .catch(() => {});
  }, [user]);

  const onPlanSelect = async (planId: string) => {
    if (planId === "free") return;
    if (!user) {
      window.location.href = `/login?next=/pricing`;
      return;
    }

    setLoadingPlanId(planId);
    setError(null);
    try {
      const res = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
      else throw new Error("No checkout URL returned");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setLoadingPlanId(null);
    }
  };

  return (
    <div className="relative min-h-screen bg-[var(--background)] text-zinc-200">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[320px] bg-gradient-to-b from-blue-950/10 via-transparent to-transparent blur-3xl pointer-events-none" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto border-b border-white/[0.06]">
        <Link href="/">
          <BrandMark size="sm" />
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/" className="text-zinc-400 hover:text-white transition-colors">
            Chat
          </Link>
          <Link href="/app" className="text-zinc-400 hover:text-white transition-colors">
            Terminal
          </Link>
          {user ? (
            <Link href="/" className="terminal-btn terminal-btn-ghost py-1.5 px-3 text-xs">
              Account
            </Link>
          ) : (
            <Link href="/login?next=/pricing" className="terminal-btn terminal-btn-primary py-1.5 px-3 text-xs">
              Sign in
            </Link>
          )}
        </nav>
      </header>

      <main className="relative z-10 px-6 pb-16 pt-4 max-w-6xl mx-auto">
        {error ? <p className="text-center text-red-400 text-sm mb-6">{error}</p> : null}
        <PricingTableOne
          plans={plans}
          title="Pricing"
          description="Start free with AI chat. Upgrade for the live terminal and managed investing."
          onPlanSelect={onPlanSelect}
          size="medium"
          theme="classic"
          currentPlanId={currentPlan}
          loadingPlanId={loadingPlanId}
        />
      </main>
    </div>
  );
}
