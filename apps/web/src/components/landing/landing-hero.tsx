"use client";

import dynamic from "next/dynamic";
import { BrandMark } from "@/components/ui/brand-mark";
import { ResponsiveHeroBanner } from "@/components/ui/responsive-hero-banner";
import { useAccount } from "@/hooks/use-account";
import "@/components/landing/pixel-blast.css";

const PixelBlast = dynamic(() => import("@/components/landing/pixel-blast.jsx"), {
  ssr: false,
});

function HeroPixelBackground() {
  return (
    <>
      <div className="landing-hero-pixel-blur">
        <PixelBlast
          variant="square"
          pixelSize={12}
          color="#1e4a8c"
          patternScale={2.4}
          patternDensity={0.72}
          pixelSizeJitter={0.25}
          enableRipples={false}
          liquid
          liquidStrength={0.08}
          liquidRadius={1.2}
          liquidWobbleSpeed={3.5}
          speed={0.3}
          edgeFade={0}
          transparent
          autoPauseOffscreen={false}
        />
      </div>
      <div className="landing-hero-pixel-dim" />
    </>
  );
}

export function LandingHero() {
  const { user } = useAccount();
  const ctaHref = user ? "/app/markets" : "/signup?next=/app/markets";

  return (
    <ResponsiveHeroBanner
      className="!min-h-0 pb-4"
      minHeightClass="min-h-0"
      logo={<BrandMark size="sm" />}
      backgroundSlot={<HeroPixelBackground />}
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
