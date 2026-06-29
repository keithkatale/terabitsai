"use client";

import { BrandMark } from "@/components/ui/brand-mark";
import { ResponsiveHeroBanner } from "@/components/ui/responsive-hero-banner";
import { LandingHeroBackground } from "./landing-hero-background";
import { LandingTrustedBy } from "./landing-trusted-by";

export function LandingHero({ ctaHref }: { ctaHref: string }) {
  return (
    <ResponsiveHeroBanner
      className="pb-4"
      minHeightClass="min-h-[min(88svh,920px)]"
      logo={<BrandMark size="sm" />}
      backgroundSlot={<LandingHeroBackground />}
      backgroundScrim={false}
      navLinks={[
        { label: "Features", href: "#features", isActive: false },
        { label: "Pricing", href: "/pricing" },
        { label: "Try chat", href: "/try" },
      ]}
      ctaButtonText="Get started"
      ctaButtonHref={ctaHref}
      badgeLabel=""
      badgeText="AI-first market analysis"
      title="Stay ahead of the"
      titleLine2="Trading Markets"
      description="AI-powered chart vision, conversational research, and autonomous portfolio monitoring — expert quality, no expertise required."
      primaryButtonText="Try for free"
      primaryButtonHref={ctaHref}
      secondaryButtonText="Try chat"
      secondaryButtonHref="/try"
      socialProofSlot={<LandingTrustedBy />}
    />
  );
}
