import { NextRequest, NextResponse } from "next/server";
import { fetchCatalystRadar } from "@/lib/intel/synthesis";
import { HOT_SYMBOLS } from "@quant/market-intel";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get("symbols");
  const symbols = symbolsParam?.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) ?? [...HOT_SYMBOLS];

  try {
    const items = await fetchCatalystRadar(symbols);
    return NextResponse.json({ success: true, items });
  } catch (err) {
    console.error("[intel/radar]", err);
    return NextResponse.json({ success: false, items: [] }, { status: 500 });
  }
}
