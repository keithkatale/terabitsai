"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { MoveLeft, HelpCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Aesthetic glowing background grids & circles */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
      
      {/* Decorative gradient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 left-1/3 w-[200px] h-[200px] bg-red-500/5 blur-[80px] rounded-full pointer-events-none" />

      {/* Main Glassmorphic Card */}
      <div className="relative z-10 max-w-md w-full bg-zinc-900/40 backdrop-blur-md border border-white/[0.06] rounded-2xl p-6 sm:p-8 text-center shadow-2xl">
        <div className="inline-flex p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20 text-cyan-400 mb-5 animate-pulse">
          <HelpCircle className="size-8" />
        </div>

        <h1 className="text-6xl sm:text-7xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-200 to-zinc-500">
          404
        </h1>
        
        <h2 className="text-lg font-bold text-white mt-3 mb-2 uppercase tracking-wide">
          Coordinates Unresolved
        </h2>
        
        <p className="text-xs sm:text-sm text-zinc-400 font-medium leading-relaxed mb-8">
          The requested path could not be mapped by our routing engine. It may have been relocated, or never existed in this dimension.
        </p>

        <div className="flex flex-col gap-2.5">
          <Link
            href="/app/home"
            className="w-full py-3 bg-[var(--accent-cyan,#00e5ff)] text-zinc-950 hover:brightness-110 font-bold rounded-lg text-xs tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,229,255,0.2)]"
          >
            <MoveLeft className="size-4" />
            RETURN TO APP
          </Link>
          <Link
            href="/"
            className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-850 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white transition-colors border border-white/[0.04]"
          >
            Go to Landing Page
          </Link>
        </div>
      </div>

      {/* Subtle footer */}
      <span className="absolute bottom-6 text-[10px] font-bold tracking-widest text-zinc-600 uppercase">
        Terabits Quantum Router v1.0
      </span>
    </div>
  );
}
