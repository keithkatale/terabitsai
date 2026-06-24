import {
  createDodoClient,
  getDodoDepositProductId,
  getDodoEnvironment,
  isDodoDepositsConfigured,
} from "@/lib/dodo-client";
import { appBaseUrl } from "@/lib/app-base-url";
import { resolvePlatformAccount } from "@/lib/ledger/ledger-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const MIN_USD = 20;
const MAX_USD = 999;

const bodySchema = z.object({
  mode: z.enum(["demo", "live"]).default("live"),
  amountUsd: z.number().finite().positive(),
  fundingMethod: z.literal("card").default("card"),
});

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!isDodoDepositsConfigured()) {
    return Response.json(
      {
        error: "Card deposits are not configured",
        hint: "Set DODO_PAYMENTS_API_KEY and DODO_DEPOSIT_PRODUCT_ID.",
      },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const { mode, amountUsd } = parsed.data;
  if (amountUsd < MIN_USD || amountUsd > MAX_USD) {
    return Response.json(
      { error: `Amount must be between ${MIN_USD} and ${MAX_USD} USD` },
      { status: 400 },
    );
  }

  const productId = getDodoDepositProductId();
  if (!productId) {
    return Response.json({ error: "Missing DODO_DEPOSIT_PRODUCT_ID" }, { status: 503 });
  }

  const account = await resolvePlatformAccount(user.id, mode);
  const amountCents = Math.round(amountUsd * 100);
  if (amountCents < 2000) {
    return Response.json({ error: "Minimum deposit is $20.00" }, { status: 400 });
  }

  const base = appBaseUrl();
  const returnUrl = `${base}/app/wallet?deposit=success`;
  const cancelUrl = `${base}/app/wallet?deposit=cancel`;

  try {
    const client = createDodoClient();
    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1, amount: amountCents }],
      customer: { email: user.email },
      return_url: returnUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: user.id,
        account_id: account.id,
        mode,
        funding_method: "card",
        app: "terabits",
      },
    });

    const checkoutUrl = session.checkout_url;
    if (!checkoutUrl) {
      return Response.json({ error: "Checkout session missing URL" }, { status: 502 });
    }

    return Response.json({
      ok: true,
      provider: "dodopayments",
      checkoutUrl,
      environment: getDodoEnvironment(),
    });
  } catch (e) {
    console.error("[dodo/checkout]", e);
    return Response.json({ error: "Failed to create checkout session" }, { status: 502 });
  }
}
