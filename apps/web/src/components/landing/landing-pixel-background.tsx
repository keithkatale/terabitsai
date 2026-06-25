"use client";

import dynamic from "next/dynamic";
import "@/components/landing/pixel-blast.css";

const PixelBlast = dynamic(() => import("@/components/landing/pixel-blast.jsx"), {
  ssr: false,
});

export function LandingPixelBackground() {
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
