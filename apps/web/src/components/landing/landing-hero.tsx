"use client";

import { BrandMark } from "@/components/ui/brand-mark";
import { ResponsiveHeroBanner } from "@/components/ui/responsive-hero-banner";
import { useAccount } from "@/hooks/use-account";
import { LandingHeroBackground } from "./landing-hero-background";
import { LandingTrustedBy } from "./landing-trusted-by";

export function LandingHero() {
  const { user } = useAccount();
  const ctaHref = user ? "/chat/markets" : "/signup?next=/chat/markets";

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
      badgeLabel="AI-first"
      badgeText="Markets terminal with streaming chart vision"
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
