"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { TradingWorkspace } from "@/components/workspace/trading-workspace";
import { AppTabProvider } from "@/contexts/app-tab-context";
import { AppAccountProvider, useAppAccount } from "@/contexts/app-account-context";
import {
  HITLApprovalModal,
  useHITLRequests,
} from "@/components/terminal/hitl-approval-modal";

import { APP_BASE } from "@/lib/routes";

function isSetupRoute(pathname: string): boolean {
  return pathname === `${APP_BASE}/setup` || pathname.startsWith(`${APP_BASE}/setup/`);
}

function AuthenticatedAppShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const onSetup = isSetupRoute(pathname);
  const { user, signOut } = useAppAccount();

  const hitlRequests = useHITLRequests();
  const [dismissedHitl, setDismissedHitl] = useState<Set<string>>(new Set());

  const pendingHitl = hitlRequests.filter((r) => !dismissedHitl.has(r.requestId));
  const activeHitl = pendingHitl[0] ?? null;

  const handleHitlDecision = (decision: "APPROVED" | "REJECTED") => {
    if (activeHitl) {
      setDismissedHitl((prev) => new Set([...prev, activeHitl.requestId]));
    }
  };

  return (
    <>
      <AppShell
        user={user}
        onSignOut={signOut}
        mainClassName="overflow-hidden"
        hideBottomNav={onSetup}
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
