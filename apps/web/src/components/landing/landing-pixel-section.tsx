"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LandingPixelBackground } from "./landing-pixel-background";

export function LandingPixelSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative isolate w-full overflow-hidden bg-[#070707]",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <LandingPixelBackground />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[#070707]/40" />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-white/5 ring-inset" />
      <div className="relative z-10">{children}</div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-24 bg-gradient-to-b from-transparent to-[#070707]" />
    </section>
  );
}
