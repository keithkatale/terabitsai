import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  BalanceSummary,
  EntryType,
  LedgerEntryInput,
  PlatformAccount,
} from "@/lib/ledger/types";

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isSupabaseAdminUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("SUPABASE_SERVICE_ROLE_KEY") ||
    error.message.includes("NEXT_PUBLIC_SUPABASE_URL is not configured")
  );
}

function adminOrServer(): SupabaseClient | Promise<SupabaseClient> {
  try {
    return createSupabaseAdminClient();
  } catch (e) {
    if (!isSupabaseAdminUnavailable(e)) throw e;
    return createSupabaseServerClient();
  }
}

async function getClient(): Promise<SupabaseClient> {
  const client = adminOrServer();
  return client instanceof Promise ? client : client;
}

function usesRpc(client: SupabaseClient): boolean {
  return !process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export async function resolvePlatformAccount(
  _userId: string,
  mode: "demo" | "live" = "demo"
): Promise<PlatformAccount> {
  const supabase = await getClient();

  if (usesRpc(supabase)) {
    const { data, error } = await supabase.rpc("ensure_platform_account", {
      p_mode: mode,
    });
    if (error) throw new Error(error.message);
    return {
      ...data,
      mode: (data.mode as "demo" | "live") ?? mode,
      display_currency: data.display_currency ?? "USD",
    } as PlatformAccount;
  }

  const { data: byMode, error: modeError } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", _userId)
    .eq("mode", mode)
    .maybeSingle();
  if (modeError) throw new Error(modeError.message);
  if (byMode) {
    return {
      ...byMode,
      mode: (byMode.mode as "demo" | "live") ?? mode,
      display_currency: byMode.display_currency ?? "USD",
    } as PlatformAccount;
  }

  const { data: created, error: createError } = await supabase
    .from("accounts")
    .insert({
      user_id: _userId,
      mode,
      status: "active",
      kyc_tier: "tier0",
      display_currency: "USD",
    })
    .select("*")
    .single();
  if (createError) throw new Error(createError.message);
  return {
    ...created,
    mode: (created.mode as "demo" | "live") ?? mode,
    display_currency: created.display_currency ?? "USD",
  } as PlatformAccount;
}

export async function getAccountBalance(
  accountId: string,
  currency = "USD"
): Promise<BalanceSummary> {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("balances")
    .select("account_id, currency, available, locked")
    .eq("account_id", accountId)
    .eq("currency", currency)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    return { account_id: accountId, currency, available: 0, locked: 0 };
  }
  return {
    account_id: String(data.account_id),
    currency: String(data.currency),
    available: toNumber(data.available),
    locked: toNumber(data.locked),
  };
}

export async function appendLedgerEntry(input: LedgerEntryInput) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Ledger amount must be positive");
  }

  const supabase = await getClient();

  if (usesRpc(supabase)) {
    const { data, error } = await supabase.rpc("append_ledger_entry", {
      p_account_id: input.accountId,
      p_amount: input.amount,
      p_entry_type: input.entryType,
      p_reference_type: input.referenceType,
      p_currency: input.currency ?? "USD",
      p_reference_id: input.referenceId ?? null,
      p_metadata: input.metadata ?? {},
    });
    if (error) throw new Error(error.message);
    return data;
  }

  const payload = {
    account_id: input.accountId,
    amount: input.amount,
    currency: input.currency ?? "USD",
    entry_type: input.entryType,
    reference_type: input.referenceType,
    reference_id: input.referenceId ?? null,
    metadata: input.metadata ?? {},
  };
  const { data, error } = await supabase
    .from("ledger_entries")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function appendSignedAdjustment(input: {
  accountId: string;
  signedAmount: number;
  currency?: string;
  referenceType: string;
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!Number.isFinite(input.signedAmount) || input.signedAmount === 0) {
    throw new Error("Adjustment amount must be a non-zero finite number");
  }

  const supabase = await getClient();

  if (usesRpc(supabase)) {
    const { data, error } = await supabase.rpc("append_signed_adjustment", {
      p_account_id: input.accountId,
      p_signed_amount: input.signedAmount,
      p_reference_type: input.referenceType,
      p_currency: input.currency ?? "USD",
      p_reference_id: input.referenceId ?? null,
      p_metadata: input.metadata ?? {},
    });
    if (error) throw new Error(error.message);
    return data;
  }

  const payload = {
    account_id: input.accountId,
    amount: input.signedAmount,
    currency: input.currency ?? "USD",
    entry_type: "adjustment" as const,
    reference_type: input.referenceType,
    reference_id: input.referenceId ?? null,
    metadata: input.metadata ?? {},
  };
  const { data, error } = await supabase
    .from("ledger_entries")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function reserveFunds(
  accountId: string,
  amount: number,
  referenceType: string,
  referenceId?: string,
  metadata?: Record<string, unknown>
) {
  return await appendLedgerEntry({
    accountId,
    amount,
    entryType: "reserve",
    referenceType,
    referenceId,
    metadata,
  });
}

export async function releaseFunds(
  accountId: string,
  amount: number,
  referenceType: string,
  referenceId?: string,
  metadata?: Record<string, unknown>
) {
  return await appendLedgerEntry({
    accountId,
    amount,
    entryType: "release",
    referenceType,
    referenceId,
    metadata,
  });
}

export async function postCashMovement(
  accountId: string,
  amount: number,
  direction: "credit" | "debit",
  referenceType: string,
  referenceId?: string,
  metadata?: Record<string, unknown>
) {
  const entryType: EntryType =
    direction === "credit" ? "deposit" : "withdrawal";
  return await appendLedgerEntry({
    accountId,
    amount,
    entryType,
    referenceType,
    referenceId,
    metadata,
  });
}
