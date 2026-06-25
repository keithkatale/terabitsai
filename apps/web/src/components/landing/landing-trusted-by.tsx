"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

const TRUSTED_TRADER_AVATARS = [
  { src: "/landing/trusted/trader-1.jpg", alt: "Trader" },
  { src: "/landing/trusted/trader-2.jpg", alt: "Trader" },
  { src: "/landing/trusted/trader-3.jpg", alt: "Trader" },
  { src: "/landing/trusted/trader-4.jpg", alt: "Trader" },
  { src: "/landing/trusted/trader-5.jpg", alt: "Trader" },
] as const;

export function LandingTrustedBy({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-fade-slide-in-2 flex flex-col items-center gap-3",
        className,
      )}
    >
      <div className="flex items-center pl-2">
        {TRUSTED_TRADER_AVATARS.map((avatar, index) => (
          <div
            key={avatar.src}
            className="relative -ml-2 size-9 overflow-hidden rounded-full ring-2 ring-[#070707] sm:size-10"
            style={{ zIndex: TRUSTED_TRADER_AVATARS.length - index }}
          >
            <Image
              src={avatar.src}
              alt={avatar.alt}
              width={40}
              height={40}
              className="size-full object-cover"
            />
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-white/70">
        Trusted by <span className="font-semibold text-white/85">15,601</span> traders worldwide
      </p>
    </div>
  );
}
