"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Brain, Check, MessageSquare, Plus, Trash2, X } from "lucide-react";
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

const PANEL_WIDTH = "min(300px, 34vw)";

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
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const active =
    conversations.find((c) => c.id === activeConversationId) ?? conversations[0];

  const onPick = useCallback(
    (id: string) => {
      onSelect(id);
      setOpen(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
    },
    [onSelect],
  );

  const handleNewChat = useCallback(() => {
    if (disabled) return;
    onNewChat();
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, [disabled, onNewChat]);

  const panelBody = (
    <>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/8 px-4 py-3">
        <div className="min-w-0">
          <p id={titleId} className="text-sm font-semibold text-white">
            Conversations
          </p>
          <p className="truncate text-[11px] text-zinc-500">
            {active ? formatConversationLabel(active) : "No chat selected"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex size-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="shrink-0 p-3">
        <button
          type="button"
          data-chat-new="true"
          disabled={disabled}
          onClick={handleNewChat}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
            "bg-cyan-500 text-black hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <Plus className="size-4" strokeWidth={2.25} />
          New chat
        </button>
      </div>

      <div
        role="listbox"
        aria-label="Recent conversations"
        className="min-h-0 flex-1 overflow-y-auto px-2 pb-4"
      >
        {conversations.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-zinc-500">
            No saved chats yet. Start a new conversation above.
          </p>
        ) : (
          conversations.map((item) => {
            const selected = item.id === activeConversationId;
            return (
              <div
                key={item.id}
                className={cn(
                  "group mb-1 flex items-center gap-1 rounded-xl border transition-colors",
                  selected
                    ? "terminal-nav-item-active"
                    : "border-transparent hover:border-white/8 hover:bg-white/[0.04]",
                )}
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-thread-item="true"
                  disabled={disabled}
                  onClick={() => onPick(item.id)}
                  onMouseEnter={() => router.prefetch(tabPath("chat", item.id))}
                  className="flex min-w-0 flex-1 items-start gap-2 px-3 py-2.5 text-left disabled:opacity-50"
                >
                  <MessageSquare
                    className={cn(
                      "mt-0.5 size-3.5 shrink-0",
                      selected ? "text-white" : "text-zinc-500",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-[13px] font-medium",
                        selected ? "text-white" : "text-zinc-200",
                      )}
                    >
                      {item.title?.trim() || "New conversation"}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-zinc-500">
                      {formatConversationDate(item.updated_at || item.created_at)}
                    </span>
                  </span>
                  {selected ? (
                    <Check className="mt-0.5 size-3.5 shrink-0 text-white" />
                  ) : null}
                </button>
                {onDelete && conversations.length > 1 ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onDelete(item.id)}
                    className="mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 disabled:opacity-30"
                    aria-label={`Delete ${item.title}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <div className={cn("flex h-full min-h-0 w-full overflow-hidden", className)}>
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="absolute top-3 right-3 z-20">
          <button
            ref={triggerRef}
            type="button"
            disabled={disabled}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? "Close recent conversations" : "Open recent conversations"}
            className={cn(
              "terminal-nav-item inline-flex size-8 items-center justify-center border border-white/10 bg-white/[0.04] text-zinc-400",
              "hover:text-zinc-200 active:scale-[0.97]",
              "disabled:cursor-not-allowed disabled:opacity-50",
              open && "terminal-nav-item-active",
            )}
          >
            <Brain className="size-3.5" strokeWidth={2} />
          </button>
        </div>
        {children}
      </div>

      <aside
        ref={panelRef}
        id={panelId}
        aria-labelledby={titleId}
        aria-hidden={!open}
        className={cn(
          "flex h-full shrink-0 flex-col overflow-hidden border-white/10 bg-[var(--terminal-surface)] transition-[width,border-color] duration-300 ease-out",
          open ? "border-l" : "border-l-0",
        )}
        style={{ width: open ? PANEL_WIDTH : 0 }}
      >
        <div
          className="flex h-full min-h-0 flex-col"
          style={{ width: PANEL_WIDTH }}
        >
          {panelBody}
        </div>
      </aside>
    </div>
  );
}
