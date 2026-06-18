"use client";

import React, { useState, useEffect } from "react";
import { getAssetLogoUrls } from "@/lib/company-logo";

interface AssetLogoIconProps {
  symbol: string;
  assetClass?: string;
  sector?: string;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

/**
 * Premium, high-performance AssetLogoIcon component that sequential-fetches multi-CDN logo endpoints.
 * Includes custom gradients for commodities and national emojis/flags for global indices.
 */
export function AssetLogoIcon({
  symbol,
  assetClass,
  sector,
  className = "",
  size = "sm"
}: AssetLogoIconProps) {
  const [sources, setSources] = useState<string[]>([]);
  const [sourceIdx, setSourceIdx] = useState(0);
  const [hasFailedAll, setHasFailedAll] = useState(false);

  useEffect(() => {
    const urls = getAssetLogoUrls(symbol, null, assetClass, sector);
    setSources(urls);
    setSourceIdx(0);
    setHasFailedAll(urls.length === 0);
  }, [symbol, assetClass, sector]);

  const handleImgError = () => {
    if (sourceIdx < sources.length - 1) {
      setSourceIdx((prev) => prev + 1);
    } else {
      setHasFailedAll(true);
    }
  };

  // Dimensions
  const sizeClasses = {
    xs: "w-4 h-4 text-[9px]",
    sm: "w-7 h-7 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-14 h-14 text-lg",
    xl: "w-20 h-24 text-2xl"
  };

  const dim = sizeClasses[size];

  // Specific Mineral Gradients for Commodities
  if (sector?.toLowerCase() === "commodities" || symbol === "GOLD" || symbol === "SILVER") {
    let bgGradient = "from-amber-400 to-amber-600"; // GOLD default
    let label = "AU";
    if (symbol.includes("SILVER") || symbol === "SLV") {
      bgGradient = "from-zinc-300 to-zinc-500";
      label = "AG";
    } else if (symbol.includes("OIL") || symbol === "USO") {
      bgGradient = "from-neutral-800 to-neutral-950 border border-neutral-700/50";
      label = "OIL";
    } else if (symbol.includes("GAS") || symbol === "UNG") {
      bgGradient = "from-sky-500 to-cyan-600";
      label = "GAS";
    } else if (symbol === "COPPER") {
      bgGradient = "from-orange-400 to-orange-700";
      label = "CU";
    } else if (symbol === "CORN") {
      bgGradient = "from-yellow-300 to-yellow-600";
      label = "🌽";
    } else if (symbol === "COFFEE") {
      bgGradient = "from-amber-800 to-amber-950";
      label = "☕";
    } else if (symbol === "COCOA") {
      bgGradient = "from-orange-900 to-amber-900";
      label = "🍫";
    } else if (symbol === "SUGAR") {
      bgGradient = "from-zinc-100 to-zinc-400 text-neutral-900";
      label = "🍬";
    }

    return (
      <div
        className={`flex items-center justify-center rounded-full font-bold shadow-md bg-gradient-to-br text-white ${dim} ${className}`}
      >
        <span>{label}</span>
      </div>
    );
  }

  // Global Index Flag Icons
  if (sector?.toLowerCase() === "indices") {
    let flagEmoji = "🌐";
    let indexLabel = symbol.slice(0, 3);
    
    if (symbol.startsWith("US")) flagEmoji = "🇺🇸";
    else if (symbol.startsWith("UK")) flagEmoji = "🇬🇧";
    else if (symbol.startsWith("DE")) flagEmoji = "🇩🇪";
    else if (symbol.startsWith("FR")) flagEmoji = "🇫🇷";
    else if (symbol.startsWith("JP")) flagEmoji = "🇯🇵";
    else if (symbol.startsWith("HK")) flagEmoji = "🇭🇰";
    else if (symbol.startsWith("ES")) flagEmoji = "🇪🇸";
    else if (symbol.startsWith("IT")) flagEmoji = "🇮🇹";
    else if (symbol.startsWith("EU")) flagEmoji = "🇪🇺";
    else if (symbol.startsWith("AU")) flagEmoji = "🇦🇺";
    else if (symbol.startsWith("CN")) flagEmoji = "🇨🇳";
    else if (symbol.startsWith("SG")) flagEmoji = "🇸🇬";
    else if (symbol === "DXY") flagEmoji = "💵";
    else if (symbol === "VIX") flagEmoji = "📈";

    return (
      <div
        className={`flex flex-col items-center justify-center rounded-lg bg-zinc-900/80 border border-zinc-800 font-semibold shadow-inner select-none ${dim} ${className}`}
      >
        <span className="text-xs leading-none">{flagEmoji}</span>
        {size !== "xs" && (
          <span className="text-[7px] font-bold text-zinc-400 mt-0.5 uppercase tracking-tighter scale-90">
            {indexLabel}
          </span>
        )}
      </div>
    );
  }

  // Render Image from sequentially tested CDN sources
  if (!hasFailedAll && sources.length > 0) {
    return (
      <div className={`relative flex-shrink-0 bg-transparent flex items-center justify-center ${dim} ${className}`}>
        <img
          src={sources[sourceIdx]}
          alt={`${symbol} logo`}
          onError={handleImgError}
          className="w-full h-full rounded-full object-contain bg-zinc-900/10"
        />
      </div>
    );
  }

  // Premium, Hash-Generated initials gradients as ultimate fallback
  const charCodeSum = symbol.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const gradients = [
    "from-indigo-500 to-purple-600",
    "from-purple-500 to-pink-600",
    "from-blue-500 to-indigo-600",
    "from-emerald-500 to-teal-600",
    "from-cyan-500 to-blue-600",
    "from-rose-500 to-orange-600",
    "from-fuchsia-500 to-pink-600",
    "from-violet-500 to-indigo-600"
  ];
  const selectedGradient = gradients[charCodeSum % gradients.length];
  const initials = symbol.slice(0, 2).toUpperCase();

  return (
    <div
      className={`flex items-center justify-center rounded-full font-bold shadow-md bg-gradient-to-br text-white tracking-wider ${dim} ${className} ${selectedGradient}`}
    >
      <span>{initials}</span>
    </div>
  );
}
