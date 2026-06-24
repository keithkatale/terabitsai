"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  fetchAccountPreferences,
  fetchLedgerSummary,
  patchTradingMode,
  type LedgerSummaryResponse,
  type TradingMode,
} from "@/lib/account/api";
import {
  readCachedTradingMode,
  writeCachedTradingMode,
} from "@/lib/account/user-app-preferences-client";
import { readHomeTabCache, writeHomeTabCache } from "@/lib/portfolio/home-tab-cache";
import type { User } from "@supabase/supabase-js";

export function useAccount() {
  const [user, setUser] = useState<User | null>(null);
  const [tradingMode, setTradingModeState] = useState<TradingMode>("demo");
  const [summary, setSummary] = useState<LedgerSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheHydratedRef = useRef(false);

  useEffect(() => {
    if (cacheHydratedRef.current) return;
    cacheHydratedRef.current = true;
    const cachedMode = readCachedTradingMode();
    const cached = readHomeTabCache(cachedMode);
    setTradingModeState(cachedMode);
    if (cached?.summary) {
      setSummary(cached.summary);
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async (modeOverride?: TradingMode, silent = false) => {
    const mode = modeOverride ?? tradingMode;
    if (!silent) setRefreshing(true);
    setError(null);
    try {
      const data = await fetchLedgerSummary(mode);
      setSummary(data);
      writeHomeTabCache(mode, { summary: data });
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load account");
      return null;
    } finally {
      if (!silent) setRefreshing(false);
      setLoading(false);
    }
  }, [tradingMode]);

  const hydratePreferences = useCallback(async () => {
    try {
      const prefs = await fetchAccountPreferences();
      setTradingModeState(prefs.trading_mode);
      writeCachedTradingMode(prefs.trading_mode);
      return prefs.trading_mode;
    } catch {
      return tradingMode;
    }
  }, [tradingMode]);

  const setTradingMode = useCallback(
    async (mode: TradingMode) => {
      setTradingModeState(mode);
      writeCachedTradingMode(mode);
      const cached = readHomeTabCache(mode);
      if (cached?.summary) {
        setSummary(cached.summary);
        setLoading(false);
      } else {
        setLoading(true);
        setSummary(null);
      }
      await patchTradingMode(mode);
      await refresh(mode);
    },
    [refresh],
  );

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        const mode = await hydratePreferences();
        await refresh(mode);
        setLoading(false);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        void hydratePreferences().then((mode) => refresh(mode));
      } else {
        setSummary(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [hydratePreferences, refresh]);

  const signOut = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }, []);

  return {
    user,
    tradingMode,
    setTradingMode,
    summary,
    loading,
    refreshing,
    error,
    refresh,
    signOut,
    accountId: summary?.account.id ?? null,
    balance: summary?.balance ?? null,
    recentActivity: summary?.recent_ledger_entries ?? [],
  };
}
