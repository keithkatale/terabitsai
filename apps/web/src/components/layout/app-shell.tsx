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
}: {
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  mainClassName?: string;
  user: { email?: string | null } | null;
  onSignOut: () => void;
  appTopBar?: ReactNode;
}) {
  const pathname = usePathname();
  const isAppRoute = pathname.startsWith("/app");
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
        showBranding={isAppRoute}
      />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className={cn(
            "relative z-20 flex shrink-0 items-center",
            isAppRoute && appTopBar ? "justify-stretch p-0" : "justify-end px-5 py-4",
            headerClassName,
          )}
        >
          {isAppRoute && appTopBar ? appTopBar : null}
        </header>

        <main
          className={cn(
            "relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden",
            isAppRoute && "pb-[calc(88px+env(safe-area-inset-bottom,0px))] lg:pb-0",
            mainClassName,
          )}
        >
          {children}
        </main>
      </div>

      {isAppRoute ? <AppBottomNav /> : null}
    </div>
  );
}
