import { NextRequest, NextResponse } from "next/server";
import { capitalAdapter } from "@/lib/execution/capital-adapter";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get("symbol")?.trim() || "BTCUSD";
  const range = searchParams.get("range") ?? "1M";

  const rUpper = range.toUpperCase();
  let days = 30;
  if (rUpper === "1Y" || rUpper === "365") days = 365;
  else if (rUpper === "3M" || rUpper === "90") days = 90;
  else if (rUpper === "1M" || rUpper === "30") days = 30;
  else if (rUpper === "1W" || rUpper === "7") days = 7;
  else if (rUpper === "1D" || rUpper === "1") days = 1;

  try {
    const candles = await capitalAdapter.fetchCandles(symbol, "", days);
    
    // Map Capital.com fields (t, o, h, l, c, v) to standardized points
    const points = candles.map((p) => ({
      time: p.t,
      open: p.o,
      high: p.h,
      low: p.l,
      close: p.c,
      volume: p.v
    }));

    return NextResponse.json({ points, symbol: symbol.toUpperCase() });
  } catch (e: any) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load candles" },
      { status: 500 }
    );
  }
}
