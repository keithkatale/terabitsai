import {
  AuthenticationError,
  createDodoClient,
  getDodoEnvironment,
  getDodoProductId,
  isDodoConfigured,
} from "@/lib/dodo-client";
import { appBaseUrl } from "@/lib/app-base-url";
import { getServerUser } from "@/lib/supabase/get-server-user";

export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await getServerUser();
  if (!auth.ok) {
    return Response.json({ error: auth.message }, { status: auth.status });
  }
  const { user } = auth;
  if (!user.email) {
    return Response.json({ error: "User email is required" }, { status: 400 });
  }

  let planId = "pro";
  try {
    const body = await request.json();
    if (typeof body?.planId === "string" && ["pro", "premium"].includes(body.planId)) {
      planId = body.planId;
    }
  } catch {
    // default pro
  }

  if (!isDodoConfigured()) {
    return Response.json(
      { error: "Payments are not configured.", hint: "Set DODO_PAYMENTS_API_KEY and product IDs." },
      { status: 503 }
    );
  }

  const productId = getDodoProductId(planId);
  if (!productId) {
    return Response.json({ error: `Missing product ID for plan: ${planId}` }, { status: 503 });
  }

  const base = appBaseUrl();
  const returnUrl = `${base}/pricing?subscribed=${planId}`;
  const cancelUrl = `${base}/pricing?cancelled=true`;

  try {
    const client = createDodoClient();
    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { email: user.email },
      return_url: returnUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: user.id,
        plan_id: planId,
        type: "app_subscription",
        app: "terabits",
      },
    });

    if (!session.checkout_url) {
      return Response.json({ error: "Checkout session did not return a URL" }, { status: 502 });
    }

    return Response.json({
      ok: true,
      provider: "dodopayments",
      checkoutUrl: session.checkout_url,
      environment: getDodoEnvironment(),
    });
  } catch (e) {
    console.error("[subscriptions/checkout]", e);
    if (e instanceof AuthenticationError) {
      return Response.json({ error: "API credentials rejected." }, { status: 502 });
    }
    return Response.json({ error: "Failed to create checkout session." }, { status: 502 });
  }
}
