"use client";

import { usePathname } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Home,
  LogIn,
  LogOut,
  MessageSquare,
  UserPlus,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogoIcon, BrandMark } from "@/components/ui/brand-mark";
import { tabPath, useAppTab, type AppTab } from "@/contexts/app-tab-context";
import { APP_BASE, chatDraftPath } from "@/lib/routes";

function NavItem({
  href,
  icon,
  label,
  expanded,
  active,
  primary,
  onClick,
}: {
  href?: string;
  icon: ReactNode;
  label: string;
  expanded: boolean;
  active?: boolean;
  primary?: boolean;
  onClick?: (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
}) {
  const className = cn(
    "terminal-nav-item group w-full items-center text-left text-xs font-semibold transition-all duration-200",
    expanded ? "h-10 justify-start gap-3 px-3" : "h-10 justify-start gap-0 px-3",
    primary
      ? "terminal-btn terminal-btn-primary !justify-start"
      : active
        ? "terminal-nav-item-active"
        : "text-zinc-400 hover:text-zinc-100",
  );

  const content = (
    <>
      <span className={cn("relative shrink-0", active && !primary && "text-white")}>
        {icon}
      </span>
      {expanded ? <span className="min-w-0 truncate">{label}</span> : null}
    </>
  );

  if (href) {
    return (
      <a href={href} onClick={onClick} title={label} className={className}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} title={label} className={className}>
      {content}
    </button>
  );
}

function shouldUseNativeNavigation(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

const APP_NAV_ITEMS: Array<{ tab: AppTab; label: string; icon: typeof Wallet }> = [
  { tab: "home", label: "Home", icon: Home },
  { tab: "chat", label: "Chat", icon: MessageSquare },
  { tab: "wallet", label: "Managed Account", icon: Wallet },
];

function AppTabNav({ expanded }: { expanded: boolean }) {
  const { activeTab, setActiveTab } = useAppTab();

  return (
    <>
      {APP_NAV_ITEMS.map(({ tab, label, icon: Icon }) => (
        <NavItem
          key={tab}
          href={tabPath(tab)}
          icon={<Icon className="size-4" strokeWidth={2} />}
          label={label}
          expanded={expanded}
          active={activeTab === tab}
          onClick={(event) => {
            if (shouldUseNativeNavigation(event as MouseEvent<HTMLAnchorElement>)) return;
            event.preventDefault();
            setActiveTab(tab);
          }}
        />
      ))}
    </>
  );
}

function SidebarBrandHeader({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  if (expanded) {
    return (
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-3">
        <BrandMark size="sm" showWordmark className="min-w-0 flex-1" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          title="Collapse navigation"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-cyan-300"
        >
          <ChevronLeft className="size-4" strokeWidth={2.5} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex justify-center border-b border-white/[0.06] px-2 py-3">
      <div
        className="group relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-white/[0.05]"
        title="Expand navigation"
      >
        <span className="flex items-center justify-center transition-all duration-200 group-hover:scale-90 group-hover:opacity-0">
          <BrandLogoIcon size="sm" />
        </span>
        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-200 group-hover:opacity-100">
          <ChevronRight className="size-4 text-cyan-300" strokeWidth={2.5} />
        </span>
      </div>
    </div>
  );
}

export function AppSidebarNav({
  expanded,
  onToggle,
  user,
  onSignOut,
  showBranding = false,
  minimalChrome = false,
}: {
  expanded: boolean;
  onToggle: () => void;
  user: { email?: string | null } | null;
  onSignOut: () => void;
  showBranding?: boolean;
  minimalChrome?: boolean;
}) {
  const pathname = usePathname();
  const onHome = pathname === "/";

  return (
    <nav
      className={cn(
        "relative z-30 hidden h-full shrink-0 flex-col bg-[var(--terminal-surface)] transition-[width] duration-300 ease-in-out select-none lg:flex",
        expanded ? "w-52" : "w-[3.75rem] cursor-pointer",
      )}
      aria-label="Main navigation"
      onClick={() => {
        if (!expanded) onToggle();
      }}
    >
      <SidebarBrandHeader expanded={expanded} onToggle={onToggle} />

      <div className="flex flex-1 flex-col gap-1.5 p-2">
        {showBranding ? (
          <AppTabNav expanded={expanded} />
        ) : minimalChrome ? null : (
          <>
            <NavItem
              href="/"
              icon={<Home className="size-4" strokeWidth={2} />}
              label="Welcome"
              expanded={expanded}
              active={onHome}
            />
            <NavItem
              href={chatDraftPath()}
              icon={<ArrowUpRight className="size-4" strokeWidth={2} />}
              label="Open app"
              expanded={expanded}
              active={pathname.startsWith(APP_BASE) || pathname.startsWith("/app")}
            />
          </>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-1.5 p-2">
        {user ? (
          <>
            {expanded && user.email ? (
              <p className="truncate px-2 pb-1 text-[10px] font-medium text-zinc-500">{user.email}</p>
            ) : null}
            <NavItem
              icon={<LogOut className="size-4" strokeWidth={2} />}
              label="Sign out"
              expanded={expanded}
              onClick={onSignOut}
            />
          </>
        ) : (
          <>
            <NavItem
              href={`/login?next=${APP_BASE}/home`}
              icon={<LogIn className="size-4" strokeWidth={2} />}
              label="Sign in"
              expanded={expanded}
            />
            <NavItem
              href={`/signup?next=${APP_BASE}/home`}
              icon={<UserPlus className="size-4" strokeWidth={2} />}
              label="Get started"
              expanded={expanded}
              primary
            />
          </>
        )}
      </div>
    </nav>
  );
}
