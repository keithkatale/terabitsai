import { NextRequest, NextResponse } from "next/server";
import { capitalAdapter } from "@/lib/execution/capital-adapter";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get("symbol")?.trim();

  if (!symbol) {
    return NextResponse.json(
      { error: "Query parameter 'symbol' is required." },
      { status: 400 }
    );
  }

  try {
    const assetClass = searchParams.get("assetClass")?.trim() || "stock";
    const quote = await capitalAdapter.fetchQuote(symbol, assetClass);

    return NextResponse.json({
      symbol: quote.symbol.toUpperCase(),
      bid: quote.bid,
      ask: quote.ask,
      spot: quote.spot,
      change24hPct: quote.change24hPct,
      spread: quote.spread,
      marketStatus: quote.marketStatus || "TRADEABLE"
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load live quote" },
      { status: 500 }
    );
  }
}
