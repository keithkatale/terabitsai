import { NextRequest, NextResponse } from "next/server";
import { searchMarketIntel } from "@quant/market-intel";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? searchParams.get("query") ?? "";
  const symbol = searchParams.get("symbol")?.toUpperCase();
  const diet = searchParams.get("diet") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? 8);

  if (!query.trim()) {
    return NextResponse.json({ success: false, error: "query required" }, { status: 400 });
  }

  try {
    const results = await searchMarketIntel({ query, symbol, diet, limit });
    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("[intel/search]", err);
    return NextResponse.json({ success: false, results: [] }, { status: 500 });
  }
}
