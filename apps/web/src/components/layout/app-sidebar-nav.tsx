"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  LogIn,
  LogOut,
  Briefcase,
  MessageSquare,
  UserPlus,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/ui/brand-mark";
import { useAppTab, type AppTab } from "@/contexts/app-tab-context";

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
  onClick?: () => void;
}) {
  const className = cn(
    "group flex w-full items-center rounded-xl text-xs font-semibold transition-all duration-200",
    expanded ? "h-10 justify-start gap-3 px-3" : "mx-auto h-10 w-10 justify-center",
    primary
      ? cn("terminal-btn-primary", expanded ? "!justify-start" : "!min-h-10 !min-w-10 !p-0")
      : active
        ? "bg-cyan-500/10 text-cyan-300"
        : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100",
  );

  const content = (
    <>
      <span className={cn("relative shrink-0", active && !primary && "text-cyan-400")}>
        {icon}
      </span>
      {expanded ? <span className="truncate">{label}</span> : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={label} className={className}>
        {content}
      </button>
    );
  }

  return (
    <Link href={href ?? "/"} title={label} className={className} prefetch scroll={false}>
      {content}
    </Link>
  );
}

const APP_NAV_ITEMS: Array<{ tab: AppTab; label: string; icon: typeof Wallet }> = [
  { tab: "home", label: "Home", icon: Wallet },
  { tab: "investing", label: "Investing", icon: Briefcase },
  { tab: "command", label: "Command", icon: MessageSquare },
];

function AppTabNav({ expanded }: { expanded: boolean }) {
  const { activeTab, setActiveTab } = useAppTab();

  return (
    <>
      {APP_NAV_ITEMS.map(({ tab, label, icon: Icon }) => (
        <NavItem
          key={tab}
          icon={<Icon className="size-4" strokeWidth={2} />}
          label={label}
          expanded={expanded}
          active={activeTab === tab}
          onClick={() => setActiveTab(tab)}
        />
      ))}
    </>
  );
}

export function AppSidebarNav({
  expanded,
  onToggle,
  user,
  onSignOut,
  showBranding = false,
}: {
  expanded: boolean;
  onToggle: () => void;
  user: { email?: string | null } | null;
  onSignOut: () => void;
  showBranding?: boolean;
}) {
  const pathname = usePathname();
  const onHome = pathname === "/";

  return (
    <nav
      className={cn(
        "relative z-30 hidden h-full shrink-0 flex-col border-r border-white/6 bg-[var(--terminal-surface)] transition-[width] duration-300 ease-in-out select-none lg:flex",
        expanded ? "w-52" : "w-[3.75rem]",
      )}
      aria-label="Main navigation"
    >
      {showBranding ? (
        <div
          className={cn(
            "border-b border-white/6",
            expanded ? "px-3 py-4" : "flex justify-center px-2 py-3",
          )}
        >
          <BrandMark size="sm" showWordmark={expanded} className="min-w-0" />
        </div>
      ) : null}

      <div
        className={cn(
          "flex items-center gap-2 p-2",
          expanded ? "justify-end px-3" : "flex-col justify-center",
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          title={expanded ? "Collapse navigation" : "Expand navigation"}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-cyan-300"
        >
          {expanded ? <ChevronLeft className="size-4" strokeWidth={2.5} /> : <ChevronRight className="size-4" strokeWidth={2.5} />}
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-2">
        {showBranding ? (
          <AppTabNav expanded={expanded} />
        ) : (
          <>
            <NavItem
              href="/"
              icon={<Home className="size-4" strokeWidth={2} />}
              label="Home"
              expanded={expanded}
              active={onHome}
            />
            <NavItem
              href="/app"
              icon={<MessageSquare className="size-4" strokeWidth={2} />}
              label="Open app"
              expanded={expanded}
              active={pathname.startsWith("/app")}
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
              href="/login?next=/app"
              icon={<LogIn className="size-4" strokeWidth={2} />}
              label="Sign in"
              expanded={expanded}
            />
            <NavItem
              href="/signup"
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
