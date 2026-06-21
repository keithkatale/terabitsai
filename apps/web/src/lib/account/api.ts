export type TradingMode = "demo" | "live";

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
    invested_value_usd?: number;
    unrealized_pnl_usd?: number;
    total_balance: number;
    currency: string;
  };
  portfolio?: {
    open_positions_count: number;
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

export async function fetchAccountPreferences(): Promise<{
  trading_mode: TradingMode;
  accounts: { live: { id: string }; demo: { id: string } };
}> {
  const res = await fetch("/api/account/preferences", { credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load preferences");
  return data;
}

export async function patchTradingMode(mode: TradingMode): Promise<void> {
  const res = await fetch("/api/account/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ trading_mode: mode }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to update trading mode");
}

export async function fetchLedgerSummary(mode: TradingMode): Promise<LedgerSummaryResponse> {
  const res = await fetch(`/api/ledger/summary?mode=${mode}`, {
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to load account");
  }
  return data;
}

export async function postDeposit(
  mode: TradingMode,
  amount: number,
  gateway = "ACH",
): Promise<void> {
  const res = await fetch("/api/funding/deposit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ mode, amount, currency: "USD", gateway }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Deposit failed");
  }
}

export async function postWithdrawal(mode: TradingMode, amount: number): Promise<void> {
  const res = await fetch("/api/funding/withdrawal-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      mode,
      requestedAmount: amount,
      method: mode === "demo" ? "demo" : "bank",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Withdrawal failed");
  }
}

export async function fetchPortfolioHistory(mode: TradingMode): Promise<{
  points: Array<{ time: number; value: number }>;
  currentValue: number;
  changePct: number;
}> {
  const res = await fetch(`/api/portfolio/history?mode=${mode}`, {
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to load portfolio history");
  }
  return data;
}

export async function fetchOpenPositions(mode: TradingMode): Promise<
  Array<{
    id: string;
    symbol: string;
    direction: "BUY" | "SELL";
    entryPrice: number;
    size: number;
    leverage: number;
    margin: number;
    tp: null;
    sl: null;
    status: "OPEN";
    timestamp: number;
  }>
> {
  const res = await fetch(`/api/portfolio/positions?mode=${mode}`, {
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to load positions");
  }
  return data.positions ?? [];
}

export async function postTradeLedger(
  mode: TradingMode,
  body:
    | {
        action: "reserve";
        amount: number;
        symbol: string;
        tradeId: string;
        side: "buy" | "sell";
        quantity?: number;
        entryPrice?: number;
        leverage?: number;
      }
    | {
        action: "release";
        amount: number;
        symbol: string;
        tradeId: string;
        side: "buy" | "sell";
        closePrice?: number;
      }
    | {
        action: "adjustment";
        signedAmount: number;
        symbol: string;
        tradeId: string;
        side: "buy" | "sell";
        closePrice?: number;
      },
): Promise<void> {
  const res = await fetch("/api/ledger/trade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ mode, ...body }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Trade ledger update failed");
  }
}

export async function purchaseAssetAtMarket(
  mode: TradingMode,
  body: {
    symbol: string;
    side: "buy" | "sell";
    size: number;
    leverage?: number;
  },
): Promise<{
  ok: boolean;
  trade: {
    id: string;
    symbol: string;
    direction: "BUY" | "SELL";
    size: number;
    leverage: number;
    margin: number;
    entryPrice: number;
    notional: number;
    bid: number;
    ask: number;
    spot: number;
  };
}> {
  const res = await fetch("/api/investing/purchase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ mode, ...body }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Purchase failed");
  }
  return data;
}

/** @deprecated use postDeposit */
export const postDemoDeposit = (amount: number, gateway?: string) =>
  postDeposit("demo", amount, gateway);

/** @deprecated use postWithdrawal */
export const postDemoWithdrawal = (amount: number) => postWithdrawal("demo", amount);
