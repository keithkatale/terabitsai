"use client";

import { Stars } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, Menu, X } from "lucide-react";
import {
  useMotionTemplate,
  useMotionValue,
  motion,
  animate,
  AnimatePresence,
} from "framer-motion";
import { BrandMark } from "@/components/ui/brand-mark";

const COLORS_TOP = ["#13FFAA", "#1E67C6", "#CE84CF", "#DD335C"];

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Try Chat", href: "/try" },
];

export interface AuroraHeroProps {
  ctaHref?: string;
}

export const AuroraHero = ({ ctaHref = "/signup" }: AuroraHeroProps) => {
  const color = useMotionValue(COLORS_TOP[0]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    animate(color, COLORS_TOP, {
      ease: "easeInOut",
      duration: 10,
      repeat: Infinity,
      repeatType: "mirror",
    });
  }, [color]);

  const backgroundImage = useMotionTemplate`radial-gradient(125% 125% at 50% 0%, #020617 50%, ${color})`;
  const border = useMotionTemplate`1px solid ${color}`;
  const boxShadow = useMotionTemplate`0px 4px 24px ${color}`;

  return (
    <motion.section
      style={{
        backgroundImage,
      }}
      className="relative min-h-screen overflow-hidden bg-gray-950 text-gray-200"
    >
      {/* Navigation */}
      <header className="relative z-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4 sm:py-5">
            {/* Logo */}
            <a href="/" className="inline-flex shrink-0">
              <BrandMark size="sm" />
            </a>

            {/* Desktop Navigation */}
            <nav className="hidden items-center gap-1 md:flex">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-full px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  {link.label}
                </a>
              ))}
              <a
                href={ctaHref}
                className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-sm font-semibold text-gray-950 transition-all hover:bg-gray-200"
              >
                Get Started
                <ArrowUpRight className="size-4" />
              </a>
            </nav>

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/10 backdrop-blur-sm md:hidden"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="size-5 text-white" />
              ) : (
                <Menu className="size-5 text-white" />
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-x-4 top-[72px] z-50 rounded-2xl border border-white/10 bg-gray-950/95 p-4 backdrop-blur-xl md:hidden"
              >
                <div className="flex flex-col gap-1">
                  {NAV_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="rounded-xl px-4 py-3 text-sm font-medium text-gray-300 transition-colors hover:bg-white/[0.08] hover:text-white"
                    >
                      {link.label}
                    </a>
                  ))}
                  <a
                    href={ctaHref}
                    onClick={() => setMobileMenuOpen(false)}
                    className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-gray-950 transition-all hover:bg-gray-200"
                  >
                    Get Started
                    <ArrowUpRight className="size-4" />
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Hero Content */}
      <div className="relative z-10 flex min-h-[calc(100vh-80px)] flex-col items-center justify-center px-4 py-16 sm:py-24">
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-4 inline-block rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium backdrop-blur-sm"
        >
          AI-Powered Trading Intelligence
        </motion.span>
        
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-4xl bg-gradient-to-br from-white to-gray-400 bg-clip-text text-center text-4xl font-medium leading-tight text-transparent sm:text-5xl sm:leading-tight md:text-7xl md:leading-tight"
        >
          AI-powered Technical Analysis tool for Traders
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="my-6 max-w-2xl text-center text-base leading-relaxed text-gray-400 md:text-lg md:leading-relaxed"
        >
          AI-powered chart vision, conversational research, and autonomous portfolio monitoring — expert quality analysis, no expertise required.
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <motion.a
            href={ctaHref}
            style={{
              border,
              boxShadow,
            }}
            whileHover={{
              scale: 1.015,
            }}
            whileTap={{
              scale: 0.985,
            }}
            className="group relative flex w-fit items-center gap-2 rounded-full bg-gray-950/10 px-6 py-3 text-base font-medium text-gray-50 transition-colors hover:bg-gray-950/50"
          >
            Start Free Trial
            <ArrowRight className="size-4 transition-transform group-hover:-rotate-45 group-active:-rotate-12" />
          </motion.a>
        </motion.div>
      </div>

      {/* Stars Background */}
      <div className="absolute inset-0 z-0">
        <Canvas>
          <Stars radius={50} count={2500} factor={4} fade speed={2} />
        </Canvas>
      </div>
    </motion.section>
  );
};

export default AuroraHero;
