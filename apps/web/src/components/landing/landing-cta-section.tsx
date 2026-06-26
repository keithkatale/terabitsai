"use client";

import { cn } from "@/lib/utils";
import { LandingLightRaysBackground } from "./landing-light-rays-background";
import { LandingCtaButton } from "./landing-ui";

export function LandingCtaSection({
  ctaHref,
  className,
}: {
  ctaHref: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "w-full px-4 py-[var(--landing-section-gap)] sm:px-6",
        className,
      )}
    >
      <div className="landing-mid-cta-card relative mx-auto flex w-full max-w-[980px] flex-col items-center gap-12 overflow-hidden px-4 py-12">
        <LandingLightRaysBackground />
        <div className="pointer-events-none absolute -left-32 top-40 h-[120px] w-[480px] rotate-[40deg] rounded-full bg-[rgba(49,107,255,0.2)] blur-[60px]" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-[100px] w-[480px] rotate-[25deg] rounded-full bg-[rgba(49,107,255,0.15)] blur-[60px]" />

        <div className="relative z-10 flex flex-col items-center gap-10 text-center">
          <h2 className="landing-section-title max-w-[680px] text-[clamp(1.75rem,3.5vw,3rem)]">
            Upgrade your
            <br />
            market research with AI
          </h2>
          <div className="flex flex-col items-center gap-2.5">
            <LandingCtaButton href={ctaHref}>Try for free</LandingCtaButton>
            <p className="font-[family-name:var(--font-manrope)] text-sm font-semibold tracking-[-0.28px] text-white/50 max-lg:text-white/60">
              No card required.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
