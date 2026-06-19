import { NextRequest, NextResponse } from "next/server";
import { getRippleGraph } from "@quant/market-intel";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();
  if (!symbol) {
    return NextResponse.json({ success: false, error: "symbol required" }, { status: 400 });
  }

  try {
    const graph = await getRippleGraph(symbol);
    return NextResponse.json({ success: true, ...graph });
  } catch (err) {
    console.error("[intel/ripple]", err);
    return NextResponse.json({ success: false, nodes: [], edges: [] }, { status: 500 });
  }
}
