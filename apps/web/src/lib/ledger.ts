import { supabase } from "./supabase";

export interface PlatformAccount {
  id: string;
  user_id: string;
  status: string;
  kyc_tier: string;
  display_currency: string;
  created_at: string;
}

export interface BalanceSummary {
  account_id: string;
  currency: string;
  available: number;
  locked: number;
}

/**
 * Ensures a platform account exists in Supabase for the given custom user UUID.
 * On first load, it will auto-create the row if not found.
 */
export async function ensurePlatformAccount(userId: string): Promise<PlatformAccount> {
  // Query existing account
  const { data: existing, error: readError } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) {
    console.error("Error reading platform account:", readError);
    throw new Error(readError.message);
  }

  if (existing) {
    return existing as PlatformAccount;
  }

  // Create new account if not present
  const { data: created, error: createError } = await supabase
    .from("accounts")
    .insert({
      user_id: userId,
      status: "active",
      kyc_tier: "tier0",
      display_currency: "USD"
    })
    .select("*")
    .single();

  if (createError) {
    console.error("Error creating platform account:", createError);
    throw new Error(createError.message);
  }

  return created as PlatformAccount;
}

/**
 * Retrieves the available and locked cash balances for an account.
 */
export async function getAccountBalance(accountId: string, currency = "USD"): Promise<BalanceSummary> {
  const { data, error } = await supabase
    .from("balances")
    .select("account_id, currency, available, locked")
    .eq("account_id", accountId)
    .eq("currency", currency)
    .maybeSingle();

  if (error) {
    console.error("Error fetching account balance:", error);
    throw new Error(error.message);
  }

  if (!data) {
    return { account_id: accountId, currency, available: 0, locked: 0 };
  }

  return {
    account_id: String(data.account_id),
    currency: String(data.currency),
    available: Number(data.available),
    locked: Number(data.locked)
  };
}

/**
 * Appends a deposit record to public.ledger_entries to fund the account.
 */
export async function postDeposit(
  accountId: string,
  amount: number,
  gateway = "ACH"
): Promise<any> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Deposit amount must be positive");
  }

  const { data, error } = await supabase
    .from("ledger_entries")
    .insert({
      account_id: accountId,
      amount: amount,
      currency: "USD",
      entry_type: "deposit",
      reference_type: "cash_movement",
      metadata: { gateway, timestamp: new Date().toISOString() }
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error posting ledger deposit:", error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Records a realized P&L adjustment from a closed CFD trade.
 * Positive values represent profit, negative represent loss.
 */
export async function postTradeAdjustment(
  accountId: string,
  signedAmount: number,
  symbol: string,
  tradeId: string,
  side: "buy" | "sell"
): Promise<any> {
  if (!Number.isFinite(signedAmount) || signedAmount === 0) {
    return null; // Ignore zero changes
  }

  const { data, error } = await supabase
    .from("ledger_entries")
    .insert({
      account_id: accountId,
      amount: signedAmount, // positive increases balance, negative decreases
      currency: "USD",
      entry_type: "adjustment",
      reference_type: "trade",
      reference_id: tradeId,
      metadata: { symbol, side, timestamp: new Date().toISOString() }
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error posting trade adjustment ledger:", error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Reserves margin for an open trade.
 */
export async function postTradeReserve(
  accountId: string,
  amount: number,
  symbol: string,
  tradeId: string,
  side: "buy" | "sell"
): Promise<any> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Reserve margin must be positive");
  }

  const { data, error } = await supabase
    .from("ledger_entries")
    .insert({
      account_id: accountId,
      amount: amount,
      currency: "USD",
      entry_type: "reserve",
      reference_type: "trade",
      reference_id: tradeId,
      metadata: { symbol, side, timestamp: new Date().toISOString() }
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error posting trade reserve ledger:", error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Releases margin for a closed trade.
 */
export async function postTradeRelease(
  accountId: string,
  amount: number,
  symbol: string,
  tradeId: string,
  side: "buy" | "sell"
): Promise<any> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Release margin must be positive");
  }

  const { data, error } = await supabase
    .from("ledger_entries")
    .insert({
      account_id: accountId,
      amount: amount,
      currency: "USD",
      entry_type: "release",
      reference_type: "trade",
      reference_id: tradeId,
      metadata: { symbol, side, timestamp: new Date().toISOString() }
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error posting trade release ledger:", error);
    throw new Error(error.message);
  }

  return data;
}
