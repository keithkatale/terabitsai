export type AssetClass = "crypto" | "stock" | "etf" | "fund" | "rwa";
export type AssetProvider = "finnhub" | "coingecko" | "internal" | "capital";

export type AssetRow = {
  id?: string;
  symbol: string;
  display_name: string;
  asset_class: AssetClass;
  provider: AssetProvider;
  provider_ref: string | null;
  logo_url?: string | null;
  sector?: string | null;
  country?: string | null;
  is_tradable?: boolean;
  is_scalpable?: boolean;
  max_leverage_x?: number;
  min_notional_usd?: number;
  status?: "active" | "inactive" | "pending";
  metadata?: Record<string, unknown>;
};
