export type KycTier = "tier0" | "tier1" | "tier2";

export type EntryType =
  | "deposit"
  | "withdrawal"
  | "reserve"
  | "release"
  | "adjustment";

export type PlatformAccount = {
  id: string;
  user_id: string;
  mode: "demo" | "live";
  status: string;
  kyc_tier: KycTier;
  display_currency: string;
  created_at: string;
  updated_at?: string;
};

export type BalanceSummary = {
  account_id: string;
  currency: string;
  available: number;
  locked: number;
};

export type LedgerEntryInput = {
  accountId: string;
  amount: number;
  currency?: string;
  entryType: EntryType;
  referenceType: string;
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
};

export type RecentLedgerEntry = {
  id: string;
  created_at: string;
  entry_type: string;
  reference_type: string;
  amount: number;
  currency: string;
  direction: "in" | "out" | "neutral";
  title: string;
  subtitle: string | null;
};
