import { NextRequest, NextResponse } from "next/server";
import {
  fetchMarketContext,
  generateCopilotGreeting,
} from "@/lib/home/copilot-greeting";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim() || "BTCUSD";

  try {
    const ctx = await fetchMarketContext(symbol);
    const greeting = await generateCopilotGreeting(ctx);
    return NextResponse.json(greeting);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate greeting";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
