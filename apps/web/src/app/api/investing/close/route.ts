import { capitalAdapter } from "@/lib/execution/capital-adapter";
import {
  appendSignedAdjustment,
  releaseFunds,
  resolvePlatformAccount,
} from "@/lib/ledger/ledger-service";
import { capturePortfolioSnapshot } from "@/lib/portfolio/capture-snapshot";
import {
  closePositionByExternalId,
  listOpenPositions,
  reducePositionByExternalId,
} from "@/lib/portfolio/positions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    mode: z.enum(["demo", "live"]).default("demo"),
    dealId: z.string().min(1),
    percent: z.number().min(1).max(99).optional(),
    size: z.number().positive().optional(),
  })
  .refine((data) => !(data.percent != null && data.size != null), {
    message: "Provide only one of percent or size for partial close",
  });

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { mode, dealId, percent, size: sizeInput } = parsed.data;
  const isPartial = percent != null || sizeInput != null;

  try {
    const account = await resolvePlatformAccount(user.id, mode);
    const localPositions = await listOpenPositions(account.id);
    const local = localPositions.find((p) => p.external_id === dealId);

    const capitalBefore = await capitalAdapter.getOpenPositions();
    const capitalPos = capitalBefore.find((p) => p.dealId === dealId);
    const closePrice = capitalPos?.markPrice ?? local?.entry_price ?? 0;
    const totalSize = capitalPos?.size ?? local?.quantity ?? 0;

    let closeSize: number | undefined;
    if (isPartial) {
      if (sizeInput != null) {
        closeSize = sizeInput;
      } else if (percent != null && totalSize > 0) {
        closeSize = Math.round(totalSize * (percent / 100) * 1_000_000) / 1_000_000;
      }
      if (!closeSize || closeSize <= 0 || closeSize >= totalSize) {
        return Response.json(
          { error: "Partial close size must be less than the open position size." },
          { status: 400 },
        );
      }
    }

    const capitalClose = await capitalAdapter.closePosition(dealId, closeSize);

    const closeFraction =
      isPartial && totalSize > 0 ? (closeSize! / totalSize) : 1;
    const margin = local?.margin_usd ?? 0;
    const marginReleased = Math.round(margin * closeFraction * 100) / 100;

    const grossPnl =
      capitalClose.profit ??
      (capitalPos?.upl != null ? capitalPos.upl * closeFraction : undefined) ??
      (local
        ? local.side === "long"
          ? (closePrice - local.entry_price) * (closeSize ?? local.quantity)
          : (local.entry_price - closePrice) * (closeSize ?? local.quantity)
        : 0);

    const finalPnl = Math.round(grossPnl * 100) / 100;
    const symbol = local?.symbol ?? capitalPos?.epic ?? "UNKNOWN";
    const side = local?.side === "short" ? "sell" : "buy";

    if (marginReleased > 0) {
      await releaseFunds(account.id, marginReleased, "trade", dealId, {
        symbol,
        side,
        close_price: closePrice,
        capital_deal_id: dealId,
        partial: isPartial,
        close_fraction: closeFraction,
      });
    }

    if (finalPnl !== 0) {
      await appendSignedAdjustment({
        accountId: account.id,
        signedAmount: finalPnl,
        referenceType: "trade",
        referenceId: `${dealId}${isPartial ? `_partial_${Date.now()}` : ""}`,
        metadata: {
          symbol,
          side,
          close_price: closePrice,
          capital_deal_id: dealId,
          source: isPartial ? "capital_partial_close" : "capital_close",
          close_fraction: closeFraction,
        },
      });
    }

    if (local) {
      if (isPartial && closeSize) {
        await reducePositionByExternalId(
          account.id,
          dealId,
          closeSize,
          closePrice,
        );
      } else {
        await closePositionByExternalId(account.id, dealId, closePrice);
      }
    }

    try {
      await capturePortfolioSnapshot(account.id, mode, {
        reason: isPartial ? "partial_close" : "close",
        force: true,
      });
    } catch (snapshotError) {
      console.warn("[investing/close] snapshot failed:", snapshotError);
    }

    return Response.json({
      ok: true,
      capitalConfirmed: true,
      dealId,
      closePrice,
      pnl: finalPnl,
      partial: isPartial,
      closeFraction,
      marginReleased,
    });
  } catch (e) {
    console.error("[investing/close]", e);
    return Response.json(
      {
        error: e instanceof Error ? e.message : "Close failed",
        capitalConfirmed: false,
      },
      { status: 500 },
    );
  }
}
