import { AppShell } from "@/components/layout/app-shell";
import { BloombergTerminal } from "@/components/terminal/bloomberg-terminal";

export default function AppTerminalPage() {
  return (
    <AppShell
      headerClassName="border-b border-[var(--terminal-border)] bg-[var(--background)]/90"
      mainClassName="overflow-hidden"
    >
      <BloombergTerminal />
    </AppShell>
  );
}
