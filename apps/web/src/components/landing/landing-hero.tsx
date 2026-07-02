"use client";

import { AuroraHero } from "@/components/ui/futuristic-hero-section";

export function LandingHero({ ctaHref }: { ctaHref: string }) {
  return <AuroraHero ctaHref={ctaHref} />;
}
