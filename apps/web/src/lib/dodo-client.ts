import DodoPayments from "dodopayments";
import { AuthenticationError } from "dodopayments";

export { AuthenticationError };

function getDodoApiKey(): string | undefined {
  let raw = process.env.DODO_PAYMENTS_API_KEY?.trim() || process.env.DODO_API_KEY?.trim();
  if (!raw) return undefined;
  if (/^bearer\s+/i.test(raw)) raw = raw.replace(/^bearer\s+/i, "").trim();
  return raw || undefined;
}

export function getDodoWebhookSecret(): string | null {
  const raw = process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim() || process.env.DODO_WEBHOOK_SECRET?.trim();
  if (!raw || raw.startsWith("http")) return null;
  return raw;
}

export function getDodoEnvironment(): "test_mode" | "live_mode" {
  const raw = (process.env.DODO_PAYMENTS_ENV || "").trim().toLowerCase();
  if (raw === "live" || raw === "live_mode" || raw === "production") return "live_mode";
  return "test_mode";
}

export function createDodoClient(): DodoPayments {
  const bearerToken = getDodoApiKey();
  if (!bearerToken) throw new Error("DODO_PAYMENTS_API_KEY is not configured");
  return new DodoPayments({
    bearerToken,
    environment: getDodoEnvironment(),
    webhookKey: getDodoWebhookSecret(),
  });
}

export function getDodoProductId(planId: string): string | undefined {
  if (planId === "pro") {
    return process.env.DODO_PRO_PRODUCT_ID?.trim() || process.env.DODO_SUBSCRIPTION_PRODUCT_ID?.trim();
  }
  if (planId === "premium") {
    return process.env.DODO_PREMIUM_PRODUCT_ID?.trim();
  }
  return undefined;
}

export function isDodoConfigured(): boolean {
  return Boolean(getDodoApiKey());
}
