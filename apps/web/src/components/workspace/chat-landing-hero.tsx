"use client";

import Link from "next/link";
import InputBar, { type TaggedAsset } from "@/components/ui/input-bar";
import { BrandMark } from "@/components/ui/brand-mark";
import { MarketPreviewQueue } from "@/components/market/market-preview-queue";

export const CHAT_LANDING_PROMPT_SUGGESTIONS = [
  "What is the agent team watching today?",
  "Browse markets and propose a swing trade on BTCUSD",
  "Show engine status and active signals",
  "Summarize intel that could move my portfolio",
];

export const CHAT_LANDING_MAX_TAGGED_ASSETS = 3;

export function ChatLandingHero({
  showUpgradeLink = false,
  showBrandMark = true,
  marketPreviewEnabled = true,
  value,
  onChange,
  onSend,
  loading = false,
  taggedAssets,
  onRemoveTaggedAsset,
  onToggleTaggedAsset,
  placeholderSuggestions = CHAT_LANDING_PROMPT_SUGGESTIONS,
  maxTaggedAssets = CHAT_LANDING_MAX_TAGGED_ASSETS,
}: {
  showUpgradeLink?: boolean;
  showBrandMark?: boolean;
  marketPreviewEnabled?: boolean;
  value: string;
  onChange: (value: string) => void;
  onSend: (content: string) => void;
  loading?: boolean;
  taggedAssets: TaggedAsset[];
  onRemoveTaggedAsset: (symbol: string) => void;
  onToggleTaggedAsset: (symbol: string) => void;
  placeholderSuggestions?: string[];
  maxTaggedAssets?: number;
}) {
  return (
    <div className="relative mx-auto flex min-h-full w-full max-w-5xl flex-col items-center justify-center px-4 py-8 pb-10 text-center">
      {showBrandMark ? <BrandMark size="lg" className="mb-5" /> : null}
      {showUpgradeLink ? (
        <p className="mb-3 text-xs text-zinc-400">
          <Link href="/app?tab=command" className="font-medium text-cyan-400 hover:underline">
            Open Command to explore markets and execute trades
          </Link>
        </p>
      ) : null}
      <h1 className="mb-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
        Your Wealth Engine
      </h1>
      <p className="mb-7 max-w-md text-sm leading-relaxed text-zinc-300/85">
        AI agent teams observe markets, plan trades, pass risk checks, and help you grow capital on autopilot — starting in demo mode.
      </p>
      <div className="w-full max-w-xl">
        <InputBar
          value={value}
          onChange={onChange}
          onSend={({ content }) => onSend(content)}
          disabled={loading}
          status={loading ? "streaming" : "ready"}
          placeholder="Steer your agent team or ask for a trade plan…"
          placeholderSuggestions={placeholderSuggestions}
          variant="landing"
          taggedAssets={taggedAssets}
          onRemoveTaggedAsset={onRemoveTaggedAsset}
          maxTaggedAssets={maxTaggedAssets}
        />
      </div>
      <MarketPreviewQueue
        enabled={marketPreviewEnabled}
        taggedSymbols={taggedAssets.map((t) => t.symbol)}
        maxTags={maxTaggedAssets}
        onSelect={onToggleTaggedAsset}
      />
    </div>
  );
}
