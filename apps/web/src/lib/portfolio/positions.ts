import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function portfolioDb() {
  try {
    return createSupabaseAdminClient();
  } catch {
    return await createSupabaseServerClient();
  }
}

export type DbPosition = {
  id: string;
  account_id: string;
  mode: "demo" | "live";
  external_id: string;
  symbol: string;
  side: "long" | "short";
  quantity: number;
  entry_price: number;
  current_price: number | null;
  leverage: number;
  margin_usd: number;
  cost_basis_usd: number;
  market_value_usd: number | null;
  unrealized_pnl_usd: number | null;
  opened_at: string;
  closed_at: string | null;
  status: "open" | "closed";
};

export type PositionSummary = {
  invested_value_usd: number;
  unrealized_pnl_usd: number;
  open_count: number;
};

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function computePositionMarketValue(
  side: "long" | "short",
  quantity: number,
  entryPrice: number,
  markPrice: number,
  marginUsd: number,
): { marketValueUsd: number; unrealizedPnlUsd: number } {
  const pnl =
    side === "long"
      ? (markPrice - entryPrice) * quantity
      : (entryPrice - markPrice) * quantity;
  return {
    marketValueUsd: marginUsd + pnl,
    unrealizedPnlUsd: pnl,
  };
}

export async function listOpenPositions(accountId: string): Promise<DbPosition[]> {
  const db = await portfolioDb();
  const { data, error } = await db
    .from("positions")
    .select("*")
    .eq("account_id", accountId)
    .eq("status", "open")
    .order("opened_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    account_id: String(row.account_id),
    mode: row.mode as "demo" | "live",
    external_id: String(row.external_id),
    symbol: String(row.symbol),
    side: row.side as "long" | "short",
    quantity: toNumber(row.quantity),
    entry_price: toNumber(row.entry_price),
    current_price: row.current_price != null ? toNumber(row.current_price) : null,
    leverage: toNumber(row.leverage),
    margin_usd: toNumber(row.margin_usd),
    cost_basis_usd: toNumber(row.cost_basis_usd),
    market_value_usd: row.market_value_usd != null ? toNumber(row.market_value_usd) : null,
    unrealized_pnl_usd:
      row.unrealized_pnl_usd != null ? toNumber(row.unrealized_pnl_usd) : null,
    opened_at: String(row.opened_at),
    closed_at: row.closed_at ? String(row.closed_at) : null,
    status: row.status as "open" | "closed",
  }));
}

export async function summarizeOpenPositions(
  accountId: string,
  quotes?: Record<string, { spot?: number }>,
): Promise<PositionSummary> {
  const positions = await listOpenPositions(accountId);
  let invested = 0;
  let unrealized = 0;

  for (const pos of positions) {
    const mark = quotes?.[pos.symbol]?.spot ?? pos.current_price ?? pos.entry_price;
    const { marketValueUsd, unrealizedPnlUsd } = computePositionMarketValue(
      pos.side,
      pos.quantity,
      pos.entry_price,
      mark,
      pos.margin_usd,
    );
    invested += marketValueUsd;
    unrealized += unrealizedPnlUsd;
  }

  return {
    invested_value_usd: Math.round(invested * 100) / 100,
    unrealized_pnl_usd: Math.round(unrealized * 100) / 100,
    open_count: positions.length,
  };
}

export async function openPosition(input: {
  accountId: string;
  mode: "demo" | "live";
  externalId: string;
  symbol: string;
  side: "long" | "short";
  quantity: number;
  entryPrice: number;
  leverage: number;
  marginUsd: number;
}) {
  const db = await portfolioDb();
  const costBasis = input.quantity * input.entryPrice;
  const { marketValueUsd, unrealizedPnlUsd } = computePositionMarketValue(
    input.side,
    input.quantity,
    input.entryPrice,
    input.entryPrice,
    input.marginUsd,
  );

  const { data, error } = await db
    .from("positions")
    .insert({
      account_id: input.accountId,
      mode: input.mode,
      external_id: input.externalId,
      symbol: input.symbol,
      side: input.side,
      quantity: input.quantity,
      entry_price: input.entryPrice,
      current_price: input.entryPrice,
      leverage: input.leverage,
      margin_usd: input.marginUsd,
      cost_basis_usd: costBasis,
      market_value_usd: marketValueUsd,
      unrealized_pnl_usd: unrealizedPnlUsd,
      status: "open",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function reducePositionByExternalId(
  accountId: string,
  externalId: string,
  closeSize: number,
  closePrice: number,
) {
  const db = await portfolioDb();
  const { data: existing, error: fetchError } = await db
    .from("positions")
    .select("*")
    .eq("account_id", accountId)
    .eq("external_id", externalId)
    .eq("status", "open")
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!existing) return null;

  const side = existing.side as "long" | "short";
  const quantity = toNumber(existing.quantity);
  const entryPrice = toNumber(existing.entry_price);
  const marginUsd = toNumber(existing.margin_usd);
  const closeFraction = Math.min(1, closeSize / quantity);
  const remainingQty = Math.max(0, quantity - closeSize);

  if (remainingQty <= quantity * 0.0001) {
    return closePositionByExternalId(accountId, externalId, closePrice);
  }

  const remainingMargin =
    Math.round(marginUsd * (1 - closeFraction) * 100) / 100;
  const { marketValueUsd, unrealizedPnlUsd } = computePositionMarketValue(
    side,
    remainingQty,
    entryPrice,
    closePrice,
    remainingMargin,
  );

  const { data, error } = await db
    .from("positions")
    .update({
      quantity: remainingQty,
      margin_usd: remainingMargin,
      cost_basis_usd: remainingQty * entryPrice,
      current_price: closePrice,
      market_value_usd: marketValueUsd,
      unrealized_pnl_usd: unrealizedPnlUsd,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function closePositionByExternalId(
  accountId: string,
  externalId: string,
  closePrice: number,
) {
  const db = await portfolioDb();
  const { data: existing, error: fetchError } = await db
    .from("positions")
    .select("*")
    .eq("account_id", accountId)
    .eq("external_id", externalId)
    .eq("status", "open")
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!existing) return null;

  const side = existing.side as "long" | "short";
  const quantity = toNumber(existing.quantity);
  const entryPrice = toNumber(existing.entry_price);
  const marginUsd = toNumber(existing.margin_usd);
  const { marketValueUsd, unrealizedPnlUsd } = computePositionMarketValue(
    side,
    quantity,
    entryPrice,
    closePrice,
    marginUsd,
  );

  const { data, error } = await db
    .from("positions")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      current_price: closePrice,
      market_value_usd: marketValueUsd,
      unrealized_pnl_usd: unrealizedPnlUsd,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}
