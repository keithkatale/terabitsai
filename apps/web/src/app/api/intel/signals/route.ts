import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@quant/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);
  const symbol = searchParams.get("symbol")?.toUpperCase();
  const sector = searchParams.get("sector");

  try {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const signals = await prisma.marketSignal.findMany({
      where: {
        createdAt: { gte: since },
        ...(symbol ? { symbol } : {}),
        ...(sector ? { sector } : {})
      },
      orderBy: { createdAt: "desc" },
      take: limit
    });
    return NextResponse.json({ success: true, signals });
  } catch (err) {
    console.error("[intel/signals]", err);
    return NextResponse.json({ success: false, signals: [] }, { status: 500 });
  }
}
