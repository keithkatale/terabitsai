import { NextRequest, NextResponse } from "next/server";
import { findHistoricalAnalogs } from "@quant/market-intel";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const symbol = searchParams.get("symbol")?.toUpperCase();

  if (!q.trim()) {
    return NextResponse.json({ success: false, error: "q required" }, { status: 400 });
  }

  try {
    const analogs = await findHistoricalAnalogs(q, symbol);
    return NextResponse.json({ success: true, analogs });
  } catch (err) {
    console.error("[intel/analogs]", err);
    return NextResponse.json({ success: false, analogs: [] }, { status: 500 });
  }
}
