"use client";

import Link from "next/link";
import InputBar, { type TaggedAsset } from "@/components/ui/input-bar";
import { BrandMark } from "@/components/ui/brand-mark";
import { LandingPromptChips } from "@/components/ai-elements/follow-up-suggestions";

export const CHAT_LANDING_PROMPT_SUGGESTIONS = [
  "Set my balance goal — help me grow my account",
  "What balance target should I aim for with my current funds?",
  "What is the agent team watching today?",
  "Browse markets and propose a swing trade on BTCUSD",
  "Show engine status and active signals",
];

export const CHAT_LANDING_MAX_TAGGED_ASSETS = 3;

export function ChatLandingHero({
  showUpgradeLink = false,
  showBrandMark = true,
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
        Set a balance goal and your agent team works toward it on autopilot — checking markets every 2 minutes, executing trades, and reporting progress in this chat.
      </p>
      <div className="w-full max-w-xl">
        <InputBar
          value={value}
          onChange={onChange}
          onSend={({ content }) => onSend(content)}
          disabled={loading}
          status={loading ? "streaming" : "ready"}
          placeholder="Set a balance goal or ask your agent team…"
          placeholderSuggestions={placeholderSuggestions}
          variant="landing"
          taggedAssets={taggedAssets}
          onRemoveTaggedAsset={onRemoveTaggedAsset}
          maxTaggedAssets={maxTaggedAssets}
        />
      </div>
      <LandingPromptChips
        suggestions={placeholderSuggestions}
        disabled={loading}
        onSelect={onSend}
      />
    </div>
  );
}
