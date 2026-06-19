import { NextRequest, NextResponse } from "next/server";
import { IntelFeedResponseSchema } from "@quant/contracts";
import { fetchIntelFeed } from "@/lib/intel/feed";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? 50);
  const tab = searchParams.get("tab");
  const sector = searchParams.get("sector");
  const symbol = searchParams.get("symbol");

  try {
    const items = await fetchIntelFeed({ limit, tab, sector, symbol });
    const body = IntelFeedResponseSchema.parse({ success: true, items });
    return NextResponse.json(body);
  } catch (err) {
    console.error("[intel/feed]", err);
    return NextResponse.json({ success: false, items: [] }, { status: 500 });
  }
}
