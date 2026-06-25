"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Plus, Trash2 } from "lucide-react";
import { tabPath } from "@/contexts/app-tab-context";
import { cn } from "@/lib/utils";

export type ConversationPickerItem = {
  id: string;
  title: string;
  updated_at: string;
  created_at: string;
  is_active?: boolean;
};

function formatConversationDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 86_400_000) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (diff < 7 * 86_400_000) {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatConversationLabel(item: ConversationPickerItem): string {
  const when = formatConversationDate(item.updated_at || item.created_at);
  const title = item.title?.trim() || "New conversation";
  return when ? `${title} · ${when}` : title;
}

type ConversationPickerProps = {
  conversations: ConversationPickerItem[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete?: (id: string) => void;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
};

const PANEL_WIDTH = 260;

export function ConversationPicker({
  conversations,
  activeConversationId,
  onSelect,
  onNewChat,
  onDelete,
  disabled,
  className,
  children,
}: ConversationPickerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const titleId = useId();
  const panelId = useId();

  const active =
    conversations.find((c) => c.id === activeConversationId) ?? conversations[0];

  const onPick = useCallback(
    (id: string) => {
      onSelect(id);
    },
    [onSelect],
  );

  const handleNewChat = useCallback(() => {
    if (disabled) return;
    onNewChat();
  }, [disabled, onNewChat]);

  return (
    <div className={cn("flex h-full min-h-0 w-full overflow-hidden", className)}>
      <aside
        id={panelId}
        aria-labelledby={titleId}
        className={cn(
          "flex h-full shrink-0 flex-col overflow-hidden border-r border-white/[0.08] bg-[var(--terminal-surface)] transition-[width] duration-300 ease-out",
          open ? "w-[260px]" : "w-0 border-r-0",
        )}
      >
        <div className="flex h-full min-h-0 flex-col" style={{ width: PANEL_WIDTH }}>
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] px-3 py-2.5">
            <div className="min-w-0">
              <p id={titleId} className="text-sm font-semibold text-white">
                Conversations
              </p>
              {active ? (
                <p className="truncate text-[10px] text-zinc-500">
                  {formatConversationLabel(active)}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex size-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200"
              aria-label="Collapse conversations"
            >
              <PanelLeftClose className="size-3.5" />
            </button>
          </header>

          <div className="shrink-0 p-2">
            <button
              type="button"
              disabled={disabled}
              onClick={handleNewChat}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                "bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <Plus className="size-3.5" strokeWidth={2.25} />
              New chat
            </button>
          </div>

          <div
            role="listbox"
            aria-label="Recent conversations"
            className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3"
          >
            {conversations.length === 0 ? (
              <p className="px-2 py-6 text-center text-[11px] text-zinc-500">
                No saved chats yet.
              </p>
            ) : (
              conversations.map((item) => {
                const selected = item.id === activeConversationId;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "group mb-0.5 flex items-center gap-0.5 rounded-lg border transition-colors",
                      selected
                        ? "terminal-nav-item-active"
                        : "border-transparent hover:border-white/[0.06] hover:bg-white/[0.03]",
                    )}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      disabled={disabled}
                      onClick={() => onPick(item.id)}
                      onMouseEnter={() => router.prefetch(tabPath("chat", item.id))}
                      className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left disabled:opacity-50"
                    >
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-[12px] font-medium",
                          selected ? "text-white" : "text-zinc-300",
                        )}
                      >
                        {item.title?.trim() || "New conversation"}
                      </span>
                      <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">
                        {formatConversationDate(item.updated_at || item.created_at)}
                      </span>
                    </button>
                    {onDelete && conversations.length > 1 ? (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onDelete(item.id)}
                        className="mr-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-zinc-600 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 disabled:opacity-30"
                        aria-label={`Delete ${item.title}`}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </aside>

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {!open ? (
          <div className="absolute left-2 top-2 z-20">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setOpen(true)}
              aria-controls={panelId}
              aria-label="Open conversations"
              className="terminal-nav-item inline-flex size-8 items-center justify-center border border-white/10 bg-white/[0.04] text-zinc-400 hover:text-zinc-200"
            >
              <PanelLeftOpen className="size-3.5" strokeWidth={2} />
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
