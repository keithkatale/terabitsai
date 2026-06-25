"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { AppTopBar } from "@/components/layout/app-top-bar";
import { TradingWorkspace } from "@/components/workspace/trading-workspace";
import { AppTabProvider } from "@/contexts/app-tab-context";
import { AppAccountProvider, useAppAccount } from "@/contexts/app-account-context";
import {
  HITLApprovalModal,
  useHITLRequests,
} from "@/components/terminal/hitl-approval-modal";

function isSetupRoute(pathname: string): boolean {
  return pathname === "/app/setup" || pathname.startsWith("/app/setup/");
}

function AuthenticatedAppShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const onSetup = isSetupRoute(pathname);
  const {
    user,
    signOut,
    tradingMode,
    setTradingMode,
    balance,
    loading: accountLoading,
    openDeposit,
  } = useAppAccount();

  const accountInitialLoading = accountLoading && balance == null;

  const [engineStatus, setEngineStatus] = useState<"idle" | "running" | "scanning">("idle");
  const hitlRequests = useHITLRequests();
  const [dismissedHitl, setDismissedHitl] = useState<Set<string>>(new Set());

  const pendingHitl = hitlRequests.filter((r) => !dismissedHitl.has(r.requestId));
  const activeHitl = pendingHitl[0] ?? null;

  useEffect(() => {
    let cancelled = false;

    const loadEngineMeta = async () => {
      try {
        const statusRes = await fetch("/api/engine/status", { credentials: "include" });
        if (cancelled || !statusRes.ok) return;

        const status = (await statusRes.json()) as { mode?: string };
        setEngineStatus(
          status.mode === "running" || status.mode === "scanning"
            ? (status.mode as "running" | "scanning")
            : "idle",
        );
      } catch {
        // Non-fatal
      }
    };

    void loadEngineMeta();
    const interval = setInterval(loadEngineMeta, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleHitlDecision = (decision: "APPROVED" | "REJECTED") => {
    if (activeHitl) {
      setDismissedHitl((prev) => new Set([...prev, activeHitl.requestId]));
    }
    if (decision === "APPROVED") {
      setEngineStatus("running");
    }
  };

  return (
    <>
      <AppShell
        user={user}
        onSignOut={signOut}
        headerClassName="p-0"
        mainClassName="overflow-hidden"
        hideBottomNav={onSetup}
        appTopBar={
          onSetup ? undefined : (
            <AppTopBar
              tradingMode={tradingMode}
              onTradingModeChange={setTradingMode}
              walletAvailable={balance?.wallet_available ?? 0}
              accountLoading={accountInitialLoading}
              onDeposit={openDeposit}
              engineStatus={engineStatus}
              pendingHitl={pendingHitl.length}
            />
          )
        }
      >
        {onSetup ? children : <TradingWorkspace />}
      </AppShell>

      {activeHitl ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <HITLApprovalModal request={activeHitl} onDecision={handleHitlDecision} className="max-w-lg w-full" />
        </div>
      ) : null}
    </>
  );
}

/**
 * Single /app surface: tab switches use client-side Next.js routes.
 */
export function AuthenticatedAppShell({ children }: { children: ReactNode }) {
  return (
    <AppTabProvider>
      <AppAccountProvider>
        <AuthenticatedAppShellInner>{children}</AuthenticatedAppShellInner>
      </AppAccountProvider>
    </AppTabProvider>
  );
}
