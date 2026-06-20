"use client";

import Link from "next/link";
import InputBar, { type TaggedAsset } from "@/components/ui/input-bar";
import { BrandMark } from "@/components/ui/brand-mark";
import { MarketPreviewQueue } from "@/components/market/market-preview-queue";

export const CHAT_LANDING_PROMPT_SUGGESTIONS = [
  "What's driving Bitcoin this week?",
  "Summarize today's macro headlines",
  "Compare GOLD vs US100 in a risk-off tape",
  "Which sectors look strongest right now?",
];

export const CHAT_LANDING_MAX_TAGGED_ASSETS = 3;

export function ChatLandingHero({
  showUpgradeLink = false,
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
      <BrandMark size="lg" className="mb-5" />
      {showUpgradeLink ? (
        <p className="mb-3 text-xs text-zinc-400">
          <Link href="/app/terminal" className="font-medium text-blue-400 hover:underline">
            Upgrade to access the professional terminal
          </Link>
        </p>
      ) : null}
      <h1 className="mb-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
        Understand the Markets
      </h1>
      <p className="mb-7 max-w-md text-sm leading-relaxed text-zinc-300/85">
        Ask anything about macro trends, asset direction, and risk — AI-first analysis without the noise.
      </p>
      <div className="w-full max-w-xl">
        <InputBar
          value={value}
          onChange={onChange}
          onSend={({ content }) => onSend(content)}
          disabled={loading}
          status={loading ? "streaming" : "ready"}
          placeholder="Ask about tagged assets or anything else…"
          placeholderSuggestions={placeholderSuggestions}
          variant="landing"
          taggedAssets={taggedAssets}
          onRemoveTaggedAsset={onRemoveTaggedAsset}
          maxTaggedAssets={maxTaggedAssets}
        />
      </div>
      <MarketPreviewQueue
        taggedSymbols={taggedAssets.map((t) => t.symbol)}
        maxTags={maxTaggedAssets}
        onSelect={onToggleTaggedAsset}
      />
    </div>
  );
}
