"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  fetchLedgerSummary,
  type LedgerSummaryResponse,
} from "@/lib/account/api";
import type { User } from "@supabase/supabase-js";

export function useAccount() {
  const [user, setUser] = useState<User | null>(null);
  const [summary, setSummary] = useState<LedgerSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchLedgerSummary();
      setSummary(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load account");
    }
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        refresh().finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        refresh();
      } else {
        setSummary(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [refresh]);

  const signOut = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }, []);

  return {
    user,
    summary,
    loading,
    error,
    refresh,
    signOut,
    accountId: summary?.account.id ?? null,
    balance: summary?.balance ?? null,
    recentActivity: summary?.recent_ledger_entries ?? [],
  };
}
