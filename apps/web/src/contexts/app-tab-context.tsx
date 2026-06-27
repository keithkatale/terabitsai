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
import {
  APP_BASE,
  CHAT_DRAFT_SEGMENT,
  chatConversationPath,
  chatDraftPath,
  isConversationIdSegment,
} from "@/lib/routes";

export type AppTab = "home" | "markets" | "chat" | "wallet";

const TAB_ALIASES: Record<string, AppTab> = {
  home: "home",
  balances: "wallet",
  wallet: "wallet",
  personal: "wallet",
  portfolio: "wallet",
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
      return `${APP_BASE}/home`;
    case "wallet":
      return `${APP_BASE}/wallet`;
    case "markets":
      return `${APP_BASE}/markets`;
    case "chat":
      if (conversationId && conversationId !== CHAT_DRAFT_SEGMENT) {
        return chatConversationPath(conversationId);
      }
      return chatDraftPath();
    default:
      return chatDraftPath();
  }
}

export function parseTabFromPathname(pathname: string): {
  tab: AppTab | null;
  conversationId: string | null;
} {
  if (pathname === `${APP_BASE}/setup` || pathname.startsWith(`${APP_BASE}/setup/`)) {
    return { tab: null, conversationId: null };
  }

  if (pathname === chatDraftPath() || pathname === `${APP_BASE}/chat`) {
    return { tab: "chat", conversationId: CHAT_DRAFT_SEGMENT };
  }

  if (pathname.startsWith(`${APP_BASE}/markets`) || pathname.startsWith(`${APP_BASE}/investing`)) {
    return { tab: "markets", conversationId: null };
  }

  if (pathname.startsWith(`${APP_BASE}/wallet`)) {
    return { tab: "wallet", conversationId: null };
  }

  if (
    pathname === APP_BASE ||
    pathname.startsWith(`${APP_BASE}/home`)
  ) {
    return { tab: "home", conversationId: null };
  }

  if (pathname.startsWith(`${APP_BASE}/`)) {
    const segment = pathname.slice(`${APP_BASE}/`.length).split("/")[0];
    if (isConversationIdSegment(segment)) {
      return { tab: "chat", conversationId: segment };
    }
    if (segment === CHAT_DRAFT_SEGMENT) {
      return { tab: "chat", conversationId: CHAT_DRAFT_SEGMENT };
    }
  }

  return { tab: "home", conversationId: null };
}

type AppTabContextValue = {
  activeTab: AppTab | null;
  routeConversationId: string | null;
  setActiveTab: (tab: AppTab) => void;
  navigateToConversation: (conversationId: string, opts?: { replace?: boolean }) => void;
  navigateToNewChat: (opts?: { replace?: boolean }) => void;
  isTabActive: (tab: AppTab) => boolean;
};

const AppTabContext = createContext<AppTabContextValue | null>(null);

export function AppTabProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const route = useMemo(() => parseTabFromPathname(pathname), [pathname]);
  const [activeTab, setActiveTabState] = useState<AppTab | null>(route.tab);

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

  const navigateToNewChat = useCallback(
    (opts?: { replace?: boolean }) => {
      const href = chatDraftPath();
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
      navigateToNewChat,
      isTabActive: (tab: AppTab) => activeTab === tab,
    }),
    [activeTab, route.conversationId, setActiveTab, navigateToConversation, navigateToNewChat],
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
