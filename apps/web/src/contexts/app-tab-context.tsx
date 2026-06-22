"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AppTab = "home" | "investing" | "command";

const TAB_ALIASES: Record<string, AppTab> = {
  home: "home",
  balances: "home",
  wallet: "home",
  personal: "home",
  portfolio: "home",
  investing: "investing",
  chat: "command",
  command: "command",
  assets: "command",
  markets: "command",
  news: "command",
  signals: "command",
  engine: "command",
  autonomous: "command",
  manager: "command",
  wealth: "command",
};

export function parseAppTab(value: string | null | undefined): AppTab {
  if (!value) return "home";
  return TAB_ALIASES[value] ?? "home";
}

function readTabFromLocation(): AppTab {
  if (typeof window === "undefined") return "home";
  return parseAppTab(new URLSearchParams(window.location.search).get("tab"));
}

type AppTabContextValue = {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  isTabActive: (tab: AppTab) => boolean;
};

const AppTabContext = createContext<AppTabContextValue | null>(null);

export function AppTabProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTabState] = useState<AppTab>(readTabFromLocation);

  const setActiveTab = useCallback((tab: AppTab) => {
    setActiveTabState(tab);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.pathname = "/app";
      url.searchParams.set("tab", tab);
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  const value = useMemo(
    () => ({
      activeTab,
      setActiveTab,
      isTabActive: (tab: AppTab) => activeTab === tab,
    }),
    [activeTab, setActiveTab],
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
