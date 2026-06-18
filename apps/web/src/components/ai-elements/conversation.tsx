"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ArrowDownIcon, DownloadIcon } from "lucide-react";

export interface ConversationProps extends React.HTMLAttributes<HTMLDivElement> {
  contextRef?: any;
  instance?: any;
}

export function Conversation({ className, children, ...props }: ConversationProps) {
  return (
    <div className={cn("relative flex flex-col flex-1 h-full min-h-0 w-full", className)} {...props}>
      {children}
    </div>
  );
}

export function ConversationContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-conversation-scroll
      className={cn("flex-1 overflow-y-auto space-y-4 pr-1", className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface ConversationEmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

export function ConversationEmptyState({
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  className,
  children,
  ...props
}: ConversationEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 my-auto h-full",
        className
      )}
      {...props}
    >
      {icon && <div className="mb-4 text-neutral-500">{icon}</div>}
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-neutral-400 max-w-sm mb-4 leading-relaxed">{description}</p>
      {children}
    </div>
  );
}

interface ConversationScrollButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export function ConversationScrollButton({ className, ...props }: ConversationScrollButtonProps) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const scrollContainer = document.querySelector("[data-conversation-scroll]");
    if (!scrollContainer) return;

    const handleScroll = () => {
      const el = scrollContainer as HTMLElement;
      const threshold = 200;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      setVisible(!isNearBottom);
    };

    scrollContainer.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  const handleScrollToBottom = () => {
    const scrollContainer = document.querySelector("[data-conversation-scroll]") as HTMLElement | null;
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={handleScrollToBottom}
      className={cn(
        "absolute bottom-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900/90 text-neutral-300 hover:text-white hover:bg-neutral-800 shadow-md transition-all duration-200",
        className
      )}
      {...props}
    >
      <ArrowDownIcon className="size-4" />
      <span className="sr-only">Scroll to bottom</span>
    </button>
  );
}

interface ConversationDownloadProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  messages: Array<{ role: string; text: string }>;
  filename?: string;
  formatMessage?: (message: any, index: number) => string;
}

export function ConversationDownload({
  messages,
  filename = "conversation.md",
  formatMessage,
  className,
  ...props
}: ConversationDownloadProps) {
  const handleDownload = () => {
    const markdown = messagesToMarkdown(messages, formatMessage);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={messages.length === 0}
      className={cn(
        "px-3 py-1.5 rounded-lg text-xs font-medium border border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:text-white hover:bg-neutral-800 flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    >
      <DownloadIcon className="size-3.5" />
      <span>Download chat</span>
    </button>
  );
}

export function messagesToMarkdown(
  messages: Array<{ role: string; text: string }>,
  formatMessage?: (message: any, index: number) => string
): string {
  if (formatMessage) {
    return messages.map((msg, idx) => formatMessage(msg, idx)).join("\n\n");
  }

  return messages
    .map((msg) => {
      const roleName = msg.role === "user" ? "User" : "Terabits";
      return `### ${roleName}\n\n${msg.text}`;
    })
    .join("\n\n");
}
