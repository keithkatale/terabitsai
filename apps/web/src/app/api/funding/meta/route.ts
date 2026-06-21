import { getDodoEnvironment, isDodoDepositsConfigured } from "@/lib/dodo-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = getDodoEnvironment();
  return Response.json({
    cardDeposits: isDodoDepositsConfigured(),
    dodoCheckoutMode: env === "live_mode" ? "live" : "test",
  });
}
