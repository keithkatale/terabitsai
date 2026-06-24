"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

export type AppTab = "home" | "markets" | "chat";

const TAB_ALIASES: Record<string, AppTab> = {
  home: "home",
  balances: "home",
  wallet: "home",
  personal: "home",
  portfolio: "home",
  markets: "markets",
  investing: "markets",
  chat: "chat",
  command: "chat",
  assets: "markets",
  news: "chat",
  signals: "markets",
  engine: "markets",
  autonomous: "markets",
  manager: "markets",
  wealth: "markets",
};

export function parseAppTab(value: string | null | undefined): AppTab {
  if (!value) return "home";
  return TAB_ALIASES[value] ?? "home";
}

export function tabPath(tab: AppTab, conversationId?: string | null): string {
  switch (tab) {
    case "home":
      return "/app/wallet";
    case "markets":
      return "/app/markets";
    case "chat":
      return conversationId ? `/app/chat/${conversationId}` : "/app/chat";
    default:
      return "/app/wallet";
  }
}

export function parseTabFromPathname(pathname: string): {
  tab: AppTab;
  conversationId: string | null;
} {
  if (pathname.startsWith("/app/chat/")) {
    const id = pathname.slice("/app/chat/".length).split("/")[0];
    return { tab: "chat", conversationId: id || null };
  }
  if (pathname === "/app/chat") {
    return { tab: "chat", conversationId: null };
  }
  if (pathname.startsWith("/app/markets") || pathname.startsWith("/app/investing")) {
    return { tab: "markets", conversationId: null };
  }
  if (
    pathname === "/app" ||
    pathname.startsWith("/app/wallet") ||
    pathname.startsWith("/app/home")
  ) {
    return { tab: "home", conversationId: null };
  }
  return { tab: "home", conversationId: null };
}

type AppTabContextValue = {
  activeTab: AppTab;
  routeConversationId: string | null;
  setActiveTab: (tab: AppTab) => void;
  navigateToConversation: (conversationId: string, opts?: { replace?: boolean }) => void;
  isTabActive: (tab: AppTab) => boolean;
};

const AppTabContext = createContext<AppTabContextValue | null>(null);

export function AppTabProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const route = useMemo(() => parseTabFromPathname(pathname), [pathname]);
  const [activeTab, setActiveTabState] = useState<AppTab>(route.tab);

  useEffect(() => {
    setActiveTabState(route.tab);
  }, [route.tab]);

  const setActiveTab = useCallback(
    (tab: AppTab) => {
      router.push(tabPath(tab));
    },
    [router],
  );

  const navigateToConversation = useCallback(
    (conversationId: string, opts?: { replace?: boolean }) => {
      const href = tabPath("chat", conversationId);
      if (opts?.replace) {
        router.replace(href);
      } else {
        router.push(href);
      }
    },
    [router],
  );

  const value = useMemo(
    () => ({
      activeTab,
      routeConversationId: route.conversationId,
      setActiveTab,
      navigateToConversation,
      isTabActive: (tab: AppTab) => activeTab === tab,
    }),
    [activeTab, route.conversationId, setActiveTab, navigateToConversation],
  );

  return <AppTabContext.Provider value={value}>{children}</AppTabContext.Provider>;
}

export function useAppTab(): AppTabContextValue {
  const ctx = useContext(AppTabContext);
  if (!ctx) {
    throw new Error("useAppTab must be used within AppTabProvider");
  }
  return ctx;
}
