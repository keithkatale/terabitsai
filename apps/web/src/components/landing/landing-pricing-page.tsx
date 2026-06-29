"use client";

import { useEffect, useState } from "react";
import { Manrope, Inter, Poppins } from "next/font/google";
import { BrandMark } from "@/components/ui/brand-mark";
import { ResponsiveHeroBanner } from "@/components/ui/responsive-hero-banner";
import { useAccount } from "@/hooks/use-account";
import { plans } from "@/lib/billingsdk-config";
import { LandingHeroBackground } from "./landing-hero-background";
import { LandingCtaSection } from "./landing-cta-section";
import { LandingPricingCards } from "./landing-pricing-cards";
import {
  FaqItem,
  LandingCtaButton,
  SectionSubtitle,
} from "./landing-ui";
import "./landing-styles.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-manrope",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-poppins",
});

const PRICING_FAQ = [
  "Can I switch plans at any time?",
  "What's included in the free Chat plan?",
  "Do I need a credit card to get started?",
  "What payment methods do you accept?",
];

export function LandingPricingPage() {
  const { user } = useAccount();
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ctaHref = user ? "/app/home" : "/signup?next=/app/home";

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
    <div
      className={`landing-page min-h-screen w-full max-w-full overflow-x-clip pb-[calc(var(--landing-sticky-footer-height)+env(safe-area-inset-bottom,0px))] font-[family-name:var(--font-inter)] sm:pb-0 ${manrope.variable} ${inter.variable} ${poppins.variable}`}
    >
      <ResponsiveHeroBanner
        className="pb-2"
        minHeightClass="min-h-[88vh]"
        logo={<BrandMark size="sm" />}
        backgroundSlot={<LandingHeroBackground />}
        backgroundScrim={false}
        navLinks={[
          { label: "Features", href: "/#features" },
          { label: "Pricing", href: "/pricing", isActive: true },
          { label: "Try chat", href: "/try" },
        ]}
        ctaButtonText="Get started"
        ctaButtonHref={ctaHref}
        badgeLabel="Pricing"
        badgeText="Simple plans for every trader"
        title="Choose the plan"
        titleLine2="that fits you"
        description="Start free with AI chat. Upgrade for managed investing and autonomous portfolio monitoring when you're ready."
        primaryButtonText="Try for free"
        primaryButtonHref={ctaHref}
        secondaryButtonText="View features"
        secondaryButtonHref="/#features"
      />

      <main className="mx-auto flex w-full max-w-[980px] flex-col items-center gap-[var(--landing-section-gap)] overflow-x-clip px-4 pt-12 sm:px-6 sm:pt-16 md:pt-20">
        <section className="flex w-full flex-col items-center gap-4 text-center">
          <h2 className="landing-section-title text-[clamp(1.75rem,3.5vw,2.75rem)]">
            Transparent pricing
          </h2>
          <SectionSubtitle>
            No hidden fees. Cancel anytime. Start on Chat and upgrade when you need the full
            terminal.
          </SectionSubtitle>
        </section>

        {error ? (
          <p className="w-full rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
            {error}
          </p>
        ) : null}

        <section className="w-full">
          <LandingPricingCards
            plans={plans}
            currentPlanId={currentPlan}
            loadingPlanId={loadingPlanId}
            onPlanSelect={onPlanSelect}
          />
        </section>

        <section className="landing-mid-cta-card relative flex w-full flex-col items-center gap-10 overflow-hidden px-4 py-12">
          <div className="pointer-events-none absolute -left-32 top-32 h-[120px] w-[480px] rotate-[40deg] rounded-full bg-[rgba(49,107,255,0.2)] blur-[60px]" />
          <div className="pointer-events-none absolute -right-16 -top-8 h-[100px] w-[480px] rotate-[25deg] rounded-full bg-[rgba(49,107,255,0.15)] blur-[60px]" />
          <div className="relative flex flex-col items-center gap-4 text-center">
            <h2 className="landing-section-title max-w-[560px] text-[clamp(1.5rem,3vw,2.25rem)]">
              Not sure which plan to pick?
            </h2>
            <p className="max-w-[420px] text-base text-white/85 max-lg:text-white/90">
              Start on the free Chat plan — no card required. You can upgrade to Terminal or
              Managed anytime from your account.
            </p>
          </div>
          <div className="relative flex flex-col items-center gap-2.5">
            <LandingCtaButton href={ctaHref}>Try for free</LandingCtaButton>
            <p className="font-[family-name:var(--font-manrope)] text-sm font-semibold tracking-[-0.28px] text-white/50 max-lg:text-white/60">
              No card required.
            </p>
          </div>
        </section>

        <section className="flex w-full flex-col gap-12 lg:flex-row lg:gap-16">
          <div className="flex flex-1 flex-col gap-8">
            <h2 className="landing-section-title text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.12]">
              Pricing
              <br />
              questions
            </h2>
            <div className="flex flex-col items-start gap-2.5">
              <LandingCtaButton href={ctaHref}>Get started</LandingCtaButton>
              <p className="font-[family-name:var(--font-manrope)] text-sm font-semibold tracking-[-0.28px] text-white/50 max-lg:text-white/60">
                Free forever on Chat.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {PRICING_FAQ.map((q) => (
              <FaqItem key={q} question={q} />
            ))}
          </div>
        </section>
      </main>

      <LandingCtaSection ctaHref={ctaHref} />
    </div>
  );
}
