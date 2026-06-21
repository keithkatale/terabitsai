"use client";

import * as React from "react";
import type { WidgetAction } from "@/lib/chat/widget-actions";

type ChatWidgetContextValue = {
  onWidgetAction: (action: WidgetAction) => void;
};

const ChatWidgetContext = React.createContext<ChatWidgetContextValue | null>(null);

export function ChatWidgetProvider({
  children,
  onWidgetAction,
}: {
  children: React.ReactNode;
  onWidgetAction: (action: WidgetAction) => void;
}) {
  const value = React.useMemo(() => ({ onWidgetAction }), [onWidgetAction]);
  return <ChatWidgetContext.Provider value={value}>{children}</ChatWidgetContext.Provider>;
}

export function useChatWidgetAction(): ((action: WidgetAction) => void) | null {
  const ctx = React.useContext(ChatWidgetContext);
  return ctx?.onWidgetAction ?? null;
}
