"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AppSidebarNav } from "@/components/layout/app-sidebar-nav";
import { AppBottomNav } from "@/components/layout/app-bottom-nav";

export function AppShell({
  children,
  className,
  headerClassName,
  mainClassName,
  user,
  onSignOut,
  appTopBar,
  hideBottomNav,
}: {
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  mainClassName?: string;
  user: { email?: string | null } | null;
  onSignOut: () => void;
  appTopBar?: ReactNode;
  hideBottomNav?: boolean;
}) {
  const pathname = usePathname();
  const isAppRoute = pathname.startsWith("/app");
  const isSetupRoute = pathname === "/app/setup" || pathname.startsWith("/app/setup/");
  const [navExpanded, setNavExpanded] = useState(isAppRoute);

  useEffect(() => {
    setNavExpanded(isAppRoute);
  }, [isAppRoute]);

  return (
    <div className={cn("relative flex h-screen overflow-hidden bg-black text-zinc-200 antialiased", className)}>
      <AppSidebarNav
        expanded={navExpanded}
        onToggle={() => setNavExpanded((open) => !open)}
        user={user}
        onSignOut={onSignOut}
        showBranding={isAppRoute && !isSetupRoute}
        minimalChrome={isSetupRoute}
      />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--terminal-surface)]">
        <header
          className={cn(
            "relative z-20 flex shrink-0 items-center bg-[var(--terminal-surface)]",
            isAppRoute && appTopBar ? "justify-stretch p-0" : "justify-end px-5 py-4",
            isSetupRoute && "hidden",
            headerClassName,
          )}
        >
          {isAppRoute && appTopBar ? appTopBar : null}
        </header>

        <main
          className={cn(
            "relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden",
            isAppRoute && !isSetupRoute ? "p-1.5 sm:p-2" : "p-0",
            isAppRoute &&
              !isSetupRoute &&
              "pb-[calc(88px+env(safe-area-inset-bottom,0px)+0.5rem)] lg:pb-3",
            mainClassName,
          )}
        >
          {isAppRoute && !isSetupRoute ? (
            <div className="app-main-stage flex min-h-0 flex-1 flex-col overflow-hidden">
              {children}
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {isAppRoute && !hideBottomNav && !isSetupRoute ? <AppBottomNav /> : null}
    </div>
  );
}
