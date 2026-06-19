import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDodoWebhookSecret } from "@/lib/dodo-client";
import { Webhook } from "standardwebhooks";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const webhookKey = getDodoWebhookSecret();
  if (!webhookKey) {
    return Response.json({ error: "webhook_not_configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  let payload: Record<string, unknown>;
  try {
    const wh = new Webhook(webhookKey);
    payload = wh.verify(rawBody, headers) as Record<string, unknown>;
  } catch (e) {
    console.error("[dodo/webhook] verify failed", e);
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  }

  const type = typeof payload.type === "string" ? payload.type.toLowerCase() : "";
  if (!type.includes("subscription")) {
    return Response.json({ ok: true, ignored_type: type });
  }

  const data = payload.data as Record<string, unknown> | undefined;
  const meta =
    (payload.metadata as Record<string, string> | undefined) ??
    (data?.metadata as Record<string, string> | undefined) ??
    {};

  const subscriptionId =
    (typeof data?.subscription_id === "string" ? data.subscription_id : undefined) ??
    (typeof data?.id === "string" ? data.id : undefined) ??
    "";

  if (!subscriptionId) {
    return Response.json({ error: "missing_subscription_id" }, { status: 400 });
  }

  let status = typeof data?.status === "string" ? data.status.trim().toLowerCase() : "active";
  if (["cancelled", "canceled", "expired", "failed"].some((s) => status.includes(s))) {
    status = "cancelled";
  } else if (status.includes("active") || status.includes("trialing")) {
    status = "active";
  }

  let userId = typeof meta.user_id === "string" && UUID_RE.test(meta.user_id) ? meta.user_id : "";
  const planId = meta.plan_id === "premium" ? "premium" : "pro";

  const admin = createSupabaseAdminClient();

  if (!userId) {
    const customerObj = data?.customer as Record<string, unknown> | undefined;
    const email =
      (typeof customerObj?.email === "string" ? customerObj.email : undefined) ??
      (typeof data?.customer_email === "string" ? data.customer_email : undefined);
    if (email) {
      const { data: usersData } = await admin.auth.admin.listUsers();
      const match = usersData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (match) userId = match.id;
    }
  }

  if (!userId) {
    return Response.json({ error: "missing_user_id" }, { status: 400 });
  }

  const periodEnd =
    (typeof data?.next_billing_date === "string" ? data.next_billing_date : undefined) ??
    (typeof data?.expires_at === "string" ? data.expires_at : undefined) ??
    null;

  const dodoCustomerId =
    (typeof (data?.customer as Record<string, unknown> | undefined)?.id === "string"
      ? (data?.customer as Record<string, string>).id
      : undefined) ?? null;

  const { error } = await admin.from("app_subscriptions").upsert(
    {
      id: subscriptionId,
      user_id: userId,
      plan_id: planId,
      status,
      dodo_customer_id: dodoCustomerId,
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("[dodo/webhook]", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
