"use client";

import { cn } from "@/lib/utils";
import { AnalyticsEvents, captureEvent } from "@/lib/posthog/analytics";

/** Primary CTA — matches Figma lemlist button (#316bff). */
export function LandingCtaButton({
  href,
  children,
  className,
  size = "lg",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  size?: "lg" | "md";
}) {
  return (
    <a
      href={href}
      onClick={() => {
        captureEvent(AnalyticsEvents.CTA_CLICKED, {
          href,
          label: typeof children === "string" ? children : "cta",
        });
      }}
      className={cn(
        "terminal-btn terminal-btn-primary",
        size === "lg" ? "px-7 py-3.5 text-base" : "px-6 py-3 text-sm",
        className,
      )}
    >
      {children}
    </a>
  );
}

export function LandingGradientText({
  children,
  className,
  as: Tag = "span",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
}) {
  return (
    <Tag className={cn("landing-gradient-text", className)}>{children}</Tag>
  );
}

export function ComparisonBars({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; variant: "without" | "with" }[];
}) {
  return (
    <div className="landing-comparison-card relative w-full max-w-full overflow-hidden rounded-[24px] border border-white bg-white/[0.02] p-5 sm:p-8 md:p-10">
      <div className="landing-comparison-glow pointer-events-none absolute bottom-8 left-1/2 h-[100px] w-full max-w-[720px] -translate-x-1/2" />
      <LandingGradientText as="p" className="mb-8 text-[clamp(1.5rem,3vw,2rem)] font-semibold leading-none tracking-[-0.04em]">
        {title}
      </LandingGradientText>
      <div className="flex flex-col gap-4">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5"
          >
            <div
              className={cn(
                "min-w-0 rounded-lg border px-4 py-2 shadow-[0_0_6px_0_rgba(49,107,255,0.25)] sm:px-5",
                row.variant === "without"
                  ? "border-[#ff3131] bg-[rgba(255,49,49,0.29)]"
                  : "border-[#316bff] bg-[rgba(49,107,255,0.29)] sm:flex-1",
              )}
            >
              <LandingGradientText className="text-[clamp(1rem,4vw,1.75rem)] font-semibold leading-tight tracking-[-0.04em] sm:whitespace-nowrap">
                {row.label}
              </LandingGradientText>
            </div>
            <LandingGradientText className="shrink-0 text-[clamp(1rem,4vw,1.75rem)] font-semibold leading-tight tracking-[-0.04em] sm:whitespace-nowrap">
              {row.value}
            </LandingGradientText>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TestimonialRow({
  avatarSrc,
  name,
  quote,
}: {
  avatarSrc: string;
  name: string;
  quote: string;
}) {
  return (
    <div className="flex max-w-[520px] items-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={avatarSrc}
        alt=""
        className="size-14 shrink-0 rounded-full object-cover"
      />
      <div className="font-[family-name:var(--font-manrope)] text-sm font-semibold leading-[1.44] tracking-[-0.02em] text-white">
        <p className="mb-0">{name}</p>
        <p className="font-normal">{quote}</p>
      </div>
    </div>
  );
}

export function FaqItem({ question }: { question: string }) {
  return (
    <div className="w-full max-w-[520px] rounded-xl border border-[rgba(59,90,255,0.44)] bg-white/[0.02] px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        <p className="font-[family-name:var(--font-poppins)] text-[15px] font-medium leading-snug text-white">
          {question}
        </p>
        <span className="text-xl leading-none text-white/75 max-lg:text-white/85">+</span>
      </div>
    </div>
  );
}

export function SectionSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-w-[520px] text-center font-[family-name:var(--font-manrope)] text-lg font-semibold leading-[1.44] tracking-[-0.02em] text-white/90 max-lg:text-white/95">
      {children}
    </p>
  );
}
