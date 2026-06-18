export type LedgerSummaryResponse = {
  account: {
    id: string;
    mode: "demo" | "live";
    kyc_tier: string;
    display_currency: string;
  };
  user: { id: string; email: string | undefined };
  balance: {
    wallet_available: number;
    order_locked: number;
    total_balance: number;
    currency: string;
  };
  mode: "demo" | "live";
  recent_ledger_entries: Array<{
    id: string;
    created_at: string;
    entry_type: string;
    reference_type: string;
    amount: number;
    currency: string;
    direction: "in" | "out" | "neutral";
    title: string;
    subtitle: string | null;
  }>;
};

export async function fetchLedgerSummary(): Promise<LedgerSummaryResponse> {
  const res = await fetch("/api/ledger/summary?mode=demo", {
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to load account");
  }
  return data;
}

export async function postDemoDeposit(
  amount: number,
  gateway = "ACH"
): Promise<void> {
  const res = await fetch("/api/funding/deposit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ mode: "demo", amount, currency: "USD", gateway }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Deposit failed");
  }
}

export async function postDemoWithdrawal(amount: number): Promise<void> {
  const res = await fetch("/api/funding/withdrawal-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      mode: "demo",
      requestedAmount: amount,
      method: "demo",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Withdrawal failed");
  }
}

export async function postTradeLedger(
  body:
    | {
        action: "reserve";
        amount: number;
        symbol: string;
        tradeId: string;
        side: "buy" | "sell";
      }
    | {
        action: "release";
        amount: number;
        symbol: string;
        tradeId: string;
        side: "buy" | "sell";
      }
    | {
        action: "adjustment";
        signedAmount: number;
        symbol: string;
        tradeId: string;
        side: "buy" | "sell";
      }
): Promise<void> {
  const res = await fetch("/api/ledger/trade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Trade ledger update failed");
  }
}
