"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Menu, Play } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface NavLink {
  label: string;
  href: string;
  isActive?: boolean;
}

export interface Partner {
  logoUrl: string;
  href: string;
}

export interface ResponsiveHeroBannerProps {
  className?: string;
  minHeightClass?: string;
  logo?: ReactNode;
  backgroundImageUrl?: string;
  backgroundSlot?: ReactNode;
  navLinks?: NavLink[];
  ctaButtonText?: string;
  ctaButtonHref?: string;
  badgeText?: string;
  badgeLabel?: string;
  title?: string;
  titleLine2?: string;
  description?: string;
  primaryButtonText?: string;
  primaryButtonHref?: string;
  secondaryButtonText?: string;
  secondaryButtonHref?: string;
  heroImageUrl?: string;
  heroImageAlt?: string;
  partnersTitle?: string;
  partners?: Partner[];
  partnersBannerUrl?: string;
  socialProofSlot?: ReactNode;
  /** Dark scrim over backgroundSlot — disable for WebGL heroes like LightRays */
  backgroundScrim?: boolean;
}

export function ResponsiveHeroBanner({
  className,
  minHeightClass = "min-h-[88vh]",
  logo,
  backgroundImageUrl,
  backgroundSlot,
  navLinks = [],
  ctaButtonText = "Get started",
  ctaButtonHref = "/signup",
  badgeLabel = "New",
  badgeText = "",
  title = "",
  titleLine2 = "",
  description = "",
  primaryButtonText = "Try for free",
  primaryButtonHref = "/signup",
  secondaryButtonText = "View demo",
  secondaryButtonHref = "/try",
  heroImageUrl,
  heroImageAlt = "Product preview",
  partnersTitle = "",
  partners = [],
  partnersBannerUrl,
  socialProofSlot,
  backgroundScrim = true,
}: ResponsiveHeroBannerProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <section
      className={cn(
        "relative isolate w-full overflow-hidden bg-[#070707]",
        minHeightClass,
        className,
      )}
    >
      {backgroundSlot ? (
        <div className="pointer-events-none absolute inset-0 z-0">{backgroundSlot}</div>
      ) : backgroundImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backgroundImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}

      {backgroundScrim ? (
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[#070707]/40" />
      ) : null}
      <div className="pointer-events-none absolute inset-0 ring-1 ring-white/5 ring-inset" />

      <header className="relative z-10">
        <div className="mx-4 sm:mx-6">
          <div className="flex items-center justify-between gap-3 pt-3 sm:pt-4">
            {logo ? (
              <Link href="/" className="inline-flex shrink-0">
                {logo}
              </Link>
            ) : (
              <span className="inline-block h-10 w-[100px]" />
            )}

            <nav className="hidden items-center gap-2 md:flex">
              <div className="terminal-nav-group">
                {navLinks.map((link) => (
                  <Link
                    key={link.href + link.label}
                    href={link.href}
                    className={cn(
                      "terminal-nav-item shrink-0 whitespace-nowrap px-3.5 py-2 text-sm font-medium",
                      link.isActive ? "terminal-nav-item-active" : "",
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  href={ctaButtonHref}
                  className="terminal-btn terminal-btn-primary ml-1 shrink-0 whitespace-nowrap px-6 py-2 text-sm"
                >
                  {ctaButtonText}
                  <ArrowUpRight className="size-4" />
                </Link>
              </div>
            </nav>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 backdrop-blur md:hidden"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle menu"
            >
              <Menu className="size-5 text-white/90" />
            </button>
          </div>

          {mobileMenuOpen ? (
            <div className="mt-3 flex flex-col gap-1 rounded-2xl border border-white/10 bg-black/80 p-3 backdrop-blur-md md:hidden">
              {navLinks.map((link) => (
                <Link
                  key={link.href + link.label}
                  href={link.href}
                  className="rounded-lg px-3 py-2 text-sm text-white/85 hover:bg-white/5"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href={ctaButtonHref}
                className="terminal-btn terminal-btn-primary mt-1 w-full whitespace-nowrap px-6 py-2.5 text-sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                {ctaButtonText}
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      <div className="relative z-10">
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16 md:pt-20 lg:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            {badgeText ? (
              <div className="animate-fade-slide-in-1 mb-5 inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-2.5 py-2 backdrop-blur-md sm:mb-6 sm:gap-3">
                <span className="inline-flex items-center rounded-full border border-[#316bff]/35 bg-[#316bff]/20 px-2 py-0.5 text-xs font-semibold text-cyan-200">
                  {badgeLabel}
                </span>
                <span className="text-sm font-medium text-white/90">{badgeText}</span>
              </div>
            ) : null}

            <h1 className="animate-fade-slide-in-2 font-serif text-[clamp(2rem,8vw,4.5rem)] font-normal leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              {title}
              {titleLine2 ? (
                <>
                  <br className="hidden sm:block" />
                  {titleLine2}
                </>
              ) : null}
            </h1>

            {description ? (
              <p className="animate-fade-slide-in-3 mx-auto mt-6 max-w-2xl text-base text-white/80 sm:text-lg">
                {description}
              </p>
            ) : null}

            <div className="animate-fade-slide-in-4 mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link
                href={primaryButtonHref}
                className="terminal-btn terminal-btn-primary px-5 py-3 text-sm"
              >
                {primaryButtonText}
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href={secondaryButtonHref}
                className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-white/90 transition hover:text-white"
              >
                {secondaryButtonText}
                <Play className="size-4 fill-current" />
              </Link>
            </div>
          </div>

          {heroImageUrl ? (
            <div className="animate-fade-slide-in-3 mx-auto mt-12 max-w-5xl sm:mt-16">
              <div className="overflow-hidden rounded-xl border border-white/15 shadow-[0_40px_48px_-20px_rgba(2,4,9,0.55)]">
                <Image
                  src={heroImageUrl}
                  alt={heroImageAlt}
                  width={1217}
                  height={757}
                  className="h-auto w-full"
                  priority
                />
              </div>
            </div>
          ) : null}

          {socialProofSlot ? (
            <div className="mx-auto mt-16 max-w-5xl sm:mt-20">{socialProofSlot}</div>
          ) : (partnersBannerUrl || partners.length > 0) && partnersTitle ? (
            <div className="mx-auto mt-16 max-w-5xl sm:mt-20">
              <p className="animate-fade-slide-in-1 text-center text-sm text-white/70">
                {partnersTitle}
              </p>
              {partnersBannerUrl ? (
                <div className="animate-fade-slide-in-2 mt-6 flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={partnersBannerUrl}
                    alt=""
                    className="h-auto max-w-[580px] opacity-70"
                  />
                </div>
              ) : (
                <div className="animate-fade-slide-in-2 mt-6 grid grid-cols-2 items-center justify-items-center gap-4 text-white/70 sm:grid-cols-3 md:grid-cols-5">
                  {partners.map((partner) => (
                    <Link
                      key={partner.href + partner.logoUrl}
                      href={partner.href}
                      className="inline-flex h-9 w-[120px] items-center justify-center rounded-full bg-cover bg-center opacity-80 transition hover:opacity-100"
                      style={{ backgroundImage: `url(${partner.logoUrl})` }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-24 bg-gradient-to-b from-transparent to-[#070707]" />
    </section>
  );
}

export default ResponsiveHeroBanner;
