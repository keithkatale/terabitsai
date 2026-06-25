"use client";

import Link from "next/link";
import { chatDraftPath } from "@/lib/routes";
import InputBar, { type TaggedAsset } from "@/components/ui/input-bar";
import type { AiToolId } from "@/lib/chat/ai-tools";
import { BrandMark } from "@/components/ui/brand-mark";
import { MarketPreviewQueue } from "@/components/market/market-preview-queue";

export const CHAT_LANDING_MAX_TAGGED_ASSETS = 3;

const LANDING_COPY = {
  welcome: {
    title: "Understand the Markets",
    description:
      "Ask anything about macro trends, asset direction, and risk — AI-first analysis without the noise.",
    placeholder: "Ask about tagged assets or anything else…",
    upgrade: (
      <>
        <Link href="/pricing?upgrade=managed" className="font-medium text-cyan-400 hover:underline">
          Open Wallet
        </Link>
        {" · "}
        <Link href={chatDraftPath()} className="font-medium text-cyan-400 hover:underline">
          Open Chat
        </Link>
      </>
    ),
  },
  chat: {
    title: "Chat",
    description:
      "Chat directly with the AI — research, analysis, and ideas on your terms. Open **Markets** for AI-powered chart analysis.",
    placeholder: "Ask about markets, charts, or your portfolio…",
    upgrade: null,
  },
} as const;

export function ChatLandingHero({
  showUpgradeLink = false,
  showBrandMark = true,
  tone = "welcome",
  value,
  onChange,
  onSend,
  loading = false,
  taggedAssets,
  onRemoveTaggedAsset,
  onToggleTaggedAsset,
  maxTaggedAssets = CHAT_LANDING_MAX_TAGGED_ASSETS,
  selectedAiTools = [],
  onSelectedAiToolsChange,
}: {
  showUpgradeLink?: boolean;
  showBrandMark?: boolean;
  tone?: keyof typeof LANDING_COPY;
  value: string;
  onChange: (value: string) => void;
  onSend: (content: string) => void;
  loading?: boolean;
  taggedAssets: TaggedAsset[];
  onRemoveTaggedAsset: (symbol: string) => void;
  onToggleTaggedAsset: (symbol: string) => void;
  maxTaggedAssets?: number;
  selectedAiTools?: AiToolId[];
  onSelectedAiToolsChange?: (tools: AiToolId[]) => void;
}) {
  const copy = LANDING_COPY[tone];

  const handleAssetSelect = (symbol: string) => {
    const wasTagged = taggedAssets.some((t) => t.symbol === symbol);
    onToggleTaggedAsset(symbol);
    if (!wasTagged) {
      onChange(`Analyze ${symbol} trend and recommend a strategy.`);
    }
  };

  return (
    <div className="relative flex min-h-full w-full flex-col items-center justify-center overflow-x-hidden px-4 py-8 pb-10 text-center">
      {showBrandMark ? <BrandMark size="lg" className="mb-5" /> : null}
      {showUpgradeLink && copy.upgrade ? (
        <p className="mb-3 text-xs text-zinc-400">{copy.upgrade}</p>
      ) : null}
      <h1 className="mb-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
        {copy.title}
      </h1>
      <p className="mb-7 max-w-md text-sm leading-relaxed text-zinc-300/85">
        {copy.description}
      </p>
      <div className="w-full max-w-2xl px-4">
        <InputBar
          value={value}
          onChange={onChange}
          onSend={({ content }) => onSend(content)}
          disabled={loading}
          status={loading ? "streaming" : "ready"}
          placeholder={copy.placeholder}
          variant="landing"
          taggedAssets={taggedAssets}
          onRemoveTaggedAsset={onRemoveTaggedAsset}
          onToggleTaggedAsset={onToggleTaggedAsset}
          maxTaggedAssets={maxTaggedAssets}
          selectedAiTools={selectedAiTools}
          onSelectedAiToolsChange={onSelectedAiToolsChange}
        />
      </div>
      <MarketPreviewQueue
        taggedSymbols={taggedAssets.map((t) => t.symbol)}
        maxTags={maxTaggedAssets}
        onSelect={handleAssetSelect}
        enabled={!loading}
      />
    </div>
  );
}
