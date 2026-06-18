import { NextResponse } from "next/server";
import { capitalAdapter } from "@/lib/execution/capital-adapter";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const positions = await capitalAdapter.getOpenPositions();
    return NextResponse.json({ success: true, positions });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to fetch positions" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { symbol, side, size } = await req.json();
    const sym = symbol.toUpperCase();
    const dir = side.toUpperCase() as "BUY" | "SELL";
    const volume = Number(size);

    if (!sym || !dir || isNaN(volume) || volume <= 0) {
      return NextResponse.json({ success: false, error: "Invalid trade parameters" }, { status: 400 });
    }

    // Call Capital.com API directly to create the position
    const tradeResult = await capitalAdapter.createPosition(sym, dir, volume);

    return NextResponse.json({
      success: true,
      message: `Trade executed successfully on Capital.com!`,
      dealId: tradeResult.dealId,
      executionPrice: tradeResult.price
    });
  } catch (err: any) {
    console.error("[POST /api/trade] Trade execution failed:", err);
    return NextResponse.json({ success: false, error: err.message || "Broker execution failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dealId = searchParams.get("dealId");

    if (!dealId) {
      return NextResponse.json({ success: false, error: "Deal ID is required" }, { status: 400 });
    }

    // Call Capital.com API to close the position
    await capitalAdapter.closePosition(dealId);

    return NextResponse.json({
      success: true,
      message: "Position closed successfully on Capital.com."
    });
  } catch (err: any) {
    console.error("[DELETE /api/trade] Position closure failed:", err);
    return NextResponse.json({ success: false, error: err.message || "Broker closure failed" }, { status: 500 });
  }
}
