import { AppShell } from "@/components/layout/app-shell";
import { TradingWorkspace } from "@/components/workspace/trading-workspace";

export default function AppChatPage() {
  return (
    <AppShell headerClassName="bg-transparent" mainClassName="overflow-y-auto">
      <TradingWorkspace mode="chat" />
    </AppShell>
  );
}
