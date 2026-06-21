"use client";

import { Briefcase, MessageSquare, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppTab, type AppTab } from "@/contexts/app-tab-context";

const MOBILE_NAV_ITEMS: Array<{
  tab: AppTab;
  label: string;
  icon: typeof Wallet;
}> = [
  { tab: "home", label: "Home", icon: Wallet },
  { tab: "investing", label: "Investing", icon: Briefcase },
  { tab: "command", label: "Command", icon: MessageSquare },
];

export function AppBottomNav() {
  const { activeTab, setActiveTab } = useAppTab();

  return (
    <nav
      aria-label="App navigation"
      className={cn(
        "fixed bottom-[calc(16px+env(safe-area-inset-bottom,0px))] left-4 right-4 z-45",
        "flex items-center justify-between rounded-[24px] border border-white/8 bg-[var(--terminal-surface)]/95 px-3 py-2 shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl lg:hidden",
      )}
    >
      {MOBILE_NAV_ITEMS.map(({ tab, label, icon: Icon }) => {
        const selected = activeTab === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            aria-label={label}
            aria-current={selected ? "page" : undefined}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-1 transition-transform active:scale-95"
          >
            <Icon
              className={cn(
                "size-5 transition-colors",
                selected ? "text-cyan-400" : "text-zinc-500",
              )}
              strokeWidth={selected ? 2.25 : 1.85}
            />
            <span
              className={cn(
                "text-[10px] font-semibold leading-none",
                selected ? "text-cyan-300" : "text-zinc-500",
              )}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
