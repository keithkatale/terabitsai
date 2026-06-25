"use client";

import { BrandMark } from "@/components/ui/brand-mark";
import { ResponsiveHeroBanner } from "@/components/ui/responsive-hero-banner";
import { useAccount } from "@/hooks/use-account";
import { LandingPixelBackground } from "./landing-pixel-background";

export function LandingHero() {
  const { user } = useAccount();
  const ctaHref = user ? "/app/markets" : "/signup?next=/app/markets";

  return (
    <ResponsiveHeroBanner
      className="!min-h-0 pb-4"
      minHeightClass="min-h-0"
      logo={<BrandMark size="sm" />}
      backgroundSlot={<LandingPixelBackground />}
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
      partnersTitle="Trusted by traders and teams worldwide"
      partnersBannerUrl="/landing/logo-strip.png"
    />
  );
}
