"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAccount } from "@/hooks/use-account";
import { BrandMark } from "@/components/ui/brand-mark";
import { AppSidebarNav } from "@/components/layout/app-sidebar-nav";

export function AppShell({
  children,
  className,
  headerClassName,
  mainClassName,
}: {
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  mainClassName?: string;
}) {
  const [navExpanded, setNavExpanded] = useState(false);
  const { user, signOut } = useAccount();

  return (
    <div className={cn("relative flex h-screen overflow-hidden text-zinc-200 antialiased", className)}>
      <AppSidebarNav
        expanded={navExpanded}
        onToggle={() => setNavExpanded((open) => !open)}
        user={user}
        onSignOut={signOut}
      />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className={cn(
            "relative z-20 flex shrink-0 items-center justify-between px-5 py-4",
            headerClassName,
          )}
        >
          <BrandMark size="sm" />
          <Link
            href="/pricing"
            className="terminal-btn terminal-btn-ghost border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs backdrop-blur-sm"
          >
            Pricing
          </Link>
        </header>

        <main className={cn("relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden", mainClassName)}>
          {children}
        </main>
      </div>
    </div>
  );
}
