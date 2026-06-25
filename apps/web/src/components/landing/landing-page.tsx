"use client";

import Image from "next/image";
import { Manrope, Inter, Poppins } from "next/font/google";
import { useAccount } from "@/hooks/use-account";
import { LandingHero } from "./landing-hero";
import { LandingCtaSection } from "./landing-cta-section";
import {
  ComparisonBars,
  FaqItem,
  LandingCtaButton,
  LandingGradientText,
  SectionSubtitle,
  TestimonialRow,
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

const FAQ_ITEMS = [
  "What is Terabits AI?",
  "How does chart vision analysis work?",
  "What's the impact of AI on market research?",
  "Can AI replace human judgment in trading?",
  "How does AI improve analysis effectiveness?",
  "What are the benefits of the Markets terminal?",
  "Can AI help optimize portfolio monitoring?",
  "How do I get started with Terabits AI?",
];

export function LandingPage() {
  const { user } = useAccount();
  const ctaHref = user ? "/chat/markets" : "/signup?next=/chat/markets";

  return (
    <div
      className={`landing-page min-h-screen pb-[88px] font-[family-name:var(--font-inter)] ${manrope.variable} ${inter.variable} ${poppins.variable}`}
    >
      <LandingHero />

      <main className="mx-auto flex max-w-[980px] flex-col items-center gap-[var(--landing-section-gap)] px-6 pt-[var(--landing-section-gap)]">
        {/* Manifesto */}
        <section className="flex flex-col items-center gap-12 text-center">
          <div className="landing-manifesto-text max-w-[780px] text-[clamp(1.5rem,3.2vw,2.375rem)]">
            <p className="mb-0">We&apos;re entering a new era.</p>
            <p className="mb-0">AI won&apos;t be a revolution. It is a revolution.</p>
          </div>
          <p className="landing-manifesto-text max-w-[780px] text-[clamp(1.5rem,3.2vw,2.375rem)]">
            An era where anybody can have the power of 100 analysts at their fingertips.
          </p>
        </section>

        {/* Feature 1 — time savings */}
        <section id="features" className="flex w-full flex-col items-center gap-9">
          <div className="flex flex-col items-center gap-4 text-center">
            <h2 className="landing-section-title max-w-[680px] text-[clamp(1.75rem,3.5vw,3rem)]">
              Cut hours of chart work to minutes
            </h2>
            <SectionSubtitle>
              Skip blank-chart anxiety and get streaming AI analysis on any symbol without
              needing to be a technical analyst.
            </SectionSubtitle>
          </div>
          <ComparisonBars
            title="Analyzing a chart"
            rows={[
              { label: "without AI", value: "60min", variant: "without" },
              { label: "with AI", value: "3min", variant: "with" },
            ]}
          />
          <TestimonialRow
            avatarSrc="/landing/avatar-1.png"
            name="Alex Chen"
            quote="Got a full chart breakdown with levels, patterns, and bias in under 3 minutes. This is magic for solo traders."
          />
        </section>

        {/* Feature 2 — personalization → chart analysis at scale */}
        <section className="flex w-full flex-col items-center gap-9">
          <div className="flex flex-col items-center gap-4 text-center">
            <h2 className="landing-section-title max-w-[680px] text-[clamp(1.75rem,3.5vw,3rem)]">
              Analyze at scale
              <br />
              in seconds
            </h2>
            <p className="max-w-[520px] text-center font-[family-name:var(--font-inter)] text-lg font-normal leading-normal text-white">
              Stream chart vision, key levels, and indicator reads for every asset you
              select — powered by TradingView and Gemini.
            </p>
          </div>
          <TestimonialRow
            avatarSrc="/landing/avatar-2.png"
            name="Jordan Park"
            quote="Huge time saver! We used to spend 5–8 minutes per chart. Now the AI streams the full thesis while I watch."
          />
        </section>

        {/* Feature 3 — results */}
        <section className="flex w-full flex-col items-center gap-9">
          <div className="flex flex-col items-center gap-4 text-center">
            <h2 className="landing-section-title text-[clamp(1.75rem,3.5vw,3rem)] whitespace-pre-line">
              {`3x your\nresearch speed`}
            </h2>
            <p className="max-w-[560px] text-center font-[family-name:var(--font-inter)] text-lg font-normal leading-normal text-white">
              Automatically surface high-quality insights uniquely crafted for your watchlist
              and trading style.
            </p>
          </div>
          <ComparisonBars
            title="Results from research"
            rows={[
              { label: "without AI", value: "5 assets/hr", variant: "without" },
              { label: "with AI", value: "15 assets/hr", variant: "with" },
            ]}
          />
          <TestimonialRow
            avatarSrc="/landing/avatar-3.png"
            name="Sam Rivera"
            quote="I find the results quite impressive. I only spend a little time tweaking the final thesis."
          />
        </section>

        {/* Mid-page CTA card */}
        <section className="landing-mid-cta-card relative flex w-full flex-col items-center gap-12 overflow-hidden px-4 py-12">
          <div className="pointer-events-none absolute -left-32 top-40 h-[120px] w-[480px] rotate-[40deg] rounded-full bg-[rgba(49,107,255,0.2)] blur-[60px]" />
          <div className="pointer-events-none absolute -right-16 -top-16 h-[100px] w-[480px] rotate-[25deg] rounded-full bg-[rgba(49,107,255,0.15)] blur-[60px]" />

          <Image
            src="/landing/logo-shiny.png"
            alt=""
            width={142}
            height={142}
            className="relative h-12 w-auto object-contain"
          />
          <div className="relative flex flex-col items-center gap-10 text-center">
            <div className="flex flex-col items-center gap-4">
              <h2 className="landing-section-title max-w-[680px] text-[clamp(1.75rem,3.5vw,3rem)]">
                An AI worth 100 analysts
              </h2>
              <p className="max-w-[420px] font-[family-name:var(--font-inter)] text-lg font-normal text-white">
                Leverage AI trained on live market data, chart patterns, and institutional-grade
                research workflows.
              </p>
            </div>
            <div className="flex flex-col items-center gap-2.5">
              <LandingCtaButton href={ctaHref}>Try for free</LandingCtaButton>
              <p className="font-[family-name:var(--font-manrope)] text-sm font-semibold tracking-[-0.28px] text-white/35">
                No card required.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="flex w-full flex-col gap-16 lg:flex-row lg:gap-20">
          <div className="flex flex-1 flex-col gap-10">
            <h2 className="landing-section-title text-[clamp(1.75rem,3.5vw,3rem)] leading-[1.12]">
              Frequently
              <br />
              Asked
              <br />
              Questions
            </h2>
            <div className="flex flex-col items-start gap-2.5">
              <LandingCtaButton href={ctaHref}>Try for free</LandingCtaButton>
              <p className="font-[family-name:var(--font-manrope)] text-sm font-semibold tracking-[-0.28px] text-white/35">
                No card required.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {FAQ_ITEMS.map((q) => (
              <FaqItem key={q} question={q} />
            ))}
          </div>
        </section>
      </main>

      <LandingCtaSection ctaHref={ctaHref} />

      {/* Sticky footer banner */}
      <div className="landing-sticky-footer fixed inset-x-0 bottom-0 z-50 flex h-[88px] items-center justify-center gap-8 px-6">
        <div className="landing-footer-glow pointer-events-none absolute inset-x-0 top-0 h-5" />
        <LandingGradientText className="hidden text-[clamp(1rem,2vw,1.5rem)] font-semibold tracking-[-0.03em] sm:block">
          Ready to revolutionize your trading workflow?
        </LandingGradientText>
        <LandingCtaButton href={ctaHref} size="md">
          Try for free
        </LandingCtaButton>
      </div>
    </div>
  );
}
