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
  MessageSquare,
  Monitor,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
        ? "bg-indigo-500/10 text-indigo-300"
        : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100",
  );

  const content = (
    <>
      <span className={cn("shrink-0", active && !primary && "text-indigo-400")}>{icon}</span>
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
    <Link href={href ?? "/"} title={label} className={className}>
      {content}
    </Link>
  );
}

export function AppSidebarNav({
  expanded,
  onToggle,
  user,
  onSignOut,
}: {
  expanded: boolean;
  onToggle: () => void;
  user: { email?: string | null } | null;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const onHome = pathname === "/";
  const onChat = pathname.startsWith("/app/chat");
  const onTerminal = pathname.startsWith("/app/terminal");

  return (
    <nav
      className={cn(
        "relative z-30 flex h-full shrink-0 flex-col bg-transparent transition-[width] duration-300 ease-in-out select-none",
        expanded ? "w-52" : "w-[3.75rem]",
      )}
      aria-label="Main navigation"
    >
      <div className={cn("flex items-center p-2", expanded ? "justify-end px-3" : "justify-center")}>
        <button
          type="button"
          onClick={onToggle}
          title={expanded ? "Collapse navigation" : "Expand navigation"}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-indigo-300"
        >
          {expanded ? <ChevronLeft className="size-4" strokeWidth={2.5} /> : <ChevronRight className="size-4" strokeWidth={2.5} />}
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <NavItem
          href="/"
          icon={<Home className="size-4" strokeWidth={2} />}
          label="Home"
          expanded={expanded}
          active={onHome}
        />
        <NavItem
          href="/app/chat"
          icon={<MessageSquare className="size-4" strokeWidth={2} />}
          label="Chat"
          expanded={expanded}
          active={onChat}
        />
        <NavItem
          href="/app/terminal"
          icon={<Monitor className="size-4" strokeWidth={2} />}
          label="Terminal"
          expanded={expanded}
          active={onTerminal}
        />
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
              href="/login?next=/app/chat"
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
