"use client";

import { useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { BrandMark } from "@/components/ui/brand-mark";
import { LandingBlueGlow } from "@/components/landing/landing-blue-glow";
import { LandingLightRaysBackground } from "@/components/landing/landing-light-rays-background";
import { LandingCtaButton } from "@/components/landing/landing-ui";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "/pricing" },
];

export interface AuroraHeroProps {
  ctaHref?: string;
}

export const AuroraHero = ({ ctaHref = "/signup?next=/app/home" }: AuroraHeroProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <section className="relative min-h-[min(88svh,920px)] w-full overflow-hidden bg-[var(--landing-bg,#070707)] text-white">
      <LandingBlueGlow variant="footer" />
      <div className="landing-mid-cta-card pointer-events-none absolute inset-x-4 top-24 bottom-8 overflow-hidden sm:inset-x-6 lg:inset-x-8">
        <LandingLightRaysBackground />
        <div className="pointer-events-none absolute -left-32 top-40 h-[120px] w-[480px] rotate-[40deg] rounded-full bg-[rgba(49,107,255,0.2)] blur-[60px]" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-[100px] w-[480px] rotate-[25deg] rounded-full bg-[rgba(49,107,255,0.15)] blur-[60px]" />
      </div>

      <header className="relative z-20">
        <div className="mx-auto max-w-[980px] px-4 sm:px-6">
          <div className="flex items-center justify-between gap-3 py-4 sm:py-5">
            <a href="/" className="inline-flex shrink-0">
              <BrandMark size="sm" />
            </a>

            <nav className="hidden items-center gap-2 md:flex">
              <div className="terminal-nav-group">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="terminal-nav-item shrink-0 whitespace-nowrap px-3.5 py-2 text-sm font-medium"
                  >
                    {link.label}
                  </a>
                ))}
                <a
                  href={ctaHref}
                  className="terminal-btn terminal-btn-primary ml-1 shrink-0 whitespace-nowrap px-6 py-2 text-sm"
                >
                  Get started
                  <ArrowUpRight className="size-4" />
                </a>
              </div>
            </nav>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="inline-flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/10 backdrop-blur md:hidden"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="size-5 text-white/90" />
              ) : (
                <Menu className="size-5 text-white/90" />
              )}
            </button>
          </div>

          <AnimatePresence>
            {mobileMenuOpen ? (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="mb-3 flex flex-col gap-1 rounded-2xl border border-white/10 bg-black/80 p-3 backdrop-blur-md md:hidden"
              >
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm text-white/85 hover:bg-white/5"
                  >
                    {link.label}
                  </a>
                ))}
                <a
                  href={ctaHref}
                  onClick={() => setMobileMenuOpen(false)}
                  className="terminal-btn terminal-btn-primary mt-1 w-full whitespace-nowrap px-6 py-2.5 text-sm"
                >
                  Get started
                  <ArrowUpRight className="size-4" />
                </a>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex min-h-[calc(min(88svh,920px)-88px)] max-w-[980px] flex-col items-center justify-center px-4 pb-16 pt-8 sm:px-6 sm:pb-20">
        <div className="landing-mid-cta-card relative flex w-full flex-col items-center gap-10 overflow-hidden px-4 py-12 sm:px-8 sm:py-14">
          <LandingLightRaysBackground />
          <div className="pointer-events-none absolute -left-32 top-40 h-[120px] w-[480px] rotate-[40deg] rounded-full bg-[rgba(49,107,255,0.2)] blur-[60px]" />
          <div className="pointer-events-none absolute -right-16 -top-16 h-[100px] w-[480px] rotate-[25deg] rounded-full bg-[rgba(49,107,255,0.15)] blur-[60px]" />

          <div className="relative z-10 flex flex-col items-center gap-6 text-center sm:gap-8">
            <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-white/90 backdrop-blur-md">
              AI-first market analysis
            </span>

            <h1 className="landing-section-title max-w-[780px] text-[clamp(2rem,5vw,3.75rem)] leading-[1.08]">
              AI-powered Technical Analysis tool for Traders
            </h1>

            <p className="max-w-[620px] font-[family-name:var(--font-inter)] text-base font-normal leading-relaxed text-white/80 sm:text-lg">
              Stream chart vision, key levels, and indicator reads on any symbol with
              Terabits AI — powered by TradingView and Gemini. Cut hours of chart work
              to minutes without needing to be a technical analyst.
            </p>

            <div className="flex flex-col items-center gap-2.5">
              <LandingCtaButton href={ctaHref}>Try for free</LandingCtaButton>
              <p className="font-[family-name:var(--font-manrope)] text-sm font-semibold tracking-[-0.28px] text-white/50">
                No card required.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-24 bg-gradient-to-b from-transparent to-[#070707]" />
    </section>
  );
};

export default AuroraHero;
