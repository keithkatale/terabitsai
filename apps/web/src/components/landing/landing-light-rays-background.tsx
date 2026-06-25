"use client";

import LightRays from "@/components/landing/light-rays.jsx";
import "@/components/landing/light-rays.css";

export function LandingLightRaysBackground() {
  return (
    <div className="absolute inset-0 h-full w-full">
      <div className="landing-light-rays">
        <LightRays
          raysOrigin="top-center"
          raysColor="#7ab0ff"
          raysSpeed={1.5}
          lightSpread={0.6}
          rayLength={1.8}
          followMouse
          mouseInfluence={0.12}
          noiseAmount={0.06}
          distortion={0.05}
        />
      </div>
      <div className="landing-light-rays-dim" aria-hidden />
    </div>
  );
}
