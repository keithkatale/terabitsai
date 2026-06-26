"use client";

import { useEffect, useState } from "react";
import LightRays from "@/components/landing/light-rays.jsx";
import "@/components/landing/light-rays.css";

function useMobileViewport() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isMobile;
}

export function LandingLightRaysBackground() {
  const isMobile = useMobileViewport();

  return (
    <div className="absolute inset-0 h-full w-full">
      <div className="landing-light-rays">
        <LightRays
          raysOrigin="top-center"
          raysColor={isMobile ? "#94bcff" : "#7ab0ff"}
          raysSpeed={1.5}
          lightSpread={isMobile ? 0.74 : 0.6}
          rayLength={isMobile ? 2.15 : 1.8}
          saturation={isMobile ? 1.2 : 1}
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
