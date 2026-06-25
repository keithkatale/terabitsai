"use client";

import { chatDraftPath } from "@/lib/routes";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { type TaggedAsset } from "@/components/ui/input-bar";
import { AppShell } from "@/components/layout/app-shell";
import { PageBackground } from "@/components/ui/page-background";
import {
  ChatLandingHero,
  CHAT_LANDING_MAX_TAGGED_ASSETS,
} from "@/components/workspace/chat-landing-hero";
import { useAccount } from "@/hooks/use-account";
import { getCapitalAssetCatalog } from "@/lib/catalog/capital-assets";

const rawCapitalCatalog = getCapitalAssetCatalog();

export function WelcomeScreen() {
  const router = useRouter();
  const { user, signOut } = useAccount();
  const [value, setValue] = useState("");
  const [taggedAssets, setTaggedAssets] = useState<TaggedAsset[]>([]);

  const toggleTaggedAsset = (symbol: string) => {
    setTaggedAssets((prev) => {
      if (prev.some((t) => t.symbol === symbol)) {
        return prev.filter((t) => t.symbol !== symbol);
      }
      if (prev.length >= CHAT_LANDING_MAX_TAGGED_ASSETS) return prev;
      const item = rawCapitalCatalog.find((a) => a.symbol === symbol);
      return [
        ...prev,
        {
          symbol,
          name: item?.display_name.replace(" CFD", "").replace(" / USD", ""),
          assetClass: item?.asset_class,
          sector: item?.sector ?? null,
        },
      ];
    });
  };

  const removeTaggedAsset = (symbol: string) => {
    setTaggedAssets((prev) => prev.filter((t) => t.symbol !== symbol));
  };

  const goToChat = (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed && taggedAssets.length === 0) return;

    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "chat:pending",
        JSON.stringify({ prompt: trimmed, tags: taggedAssets }),
      );
    }

    if (!user) {
      window.location.href = `/login?next=${encodeURIComponent(chatDraftPath())}`;
      return;
    }

    router.push(chatDraftPath());
  };

  return (
    <AppShell user={user} onSignOut={signOut} headerClassName="bg-transparent" mainClassName="overflow-y-auto">
      <PageBackground overlay="minimal" variant="orb" />
      <ChatLandingHero
        showUpgradeLink
        value={value}
        onChange={setValue}
        onSend={(content) => {
          goToChat(content);
          setValue("");
          setTaggedAssets([]);
        }}
        taggedAssets={taggedAssets}
        onRemoveTaggedAsset={removeTaggedAsset}
        onToggleTaggedAsset={toggleTaggedAsset}
      />
    </AppShell>
  );
}
