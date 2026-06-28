"use client";

import Link from "next/link";
import { Briefcase, Home, MessageSquare, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { tabPath, useAppTab, type AppTab } from "@/contexts/app-tab-context";
import { AnalyticsEvents, captureEvent } from "@/lib/posthog/analytics";

const MOBILE_NAV_ITEMS: Array<{
  tab: AppTab;
  label: string;
  icon: typeof Wallet;
}> = [
  { tab: "home", label: "Home", icon: Home },
  { tab: "chat", label: "Chat", icon: MessageSquare },
  { tab: "markets", label: "Markets", icon: Briefcase },
  { tab: "wallet", label: "Wallets", icon: Wallet },
];

export function AppBottomNav() {
  const { activeTab } = useAppTab();

  return (
    <nav
      aria-label="App navigation"
      className={cn(
        "app-bottom-nav-docked fixed inset-x-0 bottom-0 z-50 lg:hidden",
        "flex items-stretch justify-around border-t border-white/10 bg-[var(--terminal-surface)]",
        "pt-1 pb-[env(safe-area-inset-bottom,0px)]",
      )}
    >
      {MOBILE_NAV_ITEMS.map(({ tab, label, icon: Icon }) => {
        const selected = activeTab === tab;
        return (
          <Link
            key={tab}
            href={tabPath(tab)}
            aria-label={label}
            aria-current={selected ? "page" : undefined}
            onClick={() => {
              if (!selected) {
                captureEvent(AnalyticsEvents.TAB_CHANGED, { tab });
              }
            }}
            className={cn(
              "flex min-h-[var(--app-bottom-nav-height)] flex-1 flex-col items-center justify-center gap-0.5 px-2 transition-colors active:bg-white/[0.04]",
              selected && "terminal-nav-item-active",
            )}
          >
            <Icon
              className={cn(
                "size-5 transition-colors",
                selected ? "text-white" : "text-zinc-500",
              )}
              strokeWidth={selected ? 2.25 : 1.85}
            />
            <span
              className={cn(
                "text-[10px] font-semibold leading-none",
                selected ? "text-white" : "text-zinc-500",
              )}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
