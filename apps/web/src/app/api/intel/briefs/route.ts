import { NextRequest, NextResponse } from "next/server";
import { fetchSynthesisBriefs } from "@/lib/intel/synthesis";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();
  const briefType = searchParams.get("type") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? 20);

  try {
    const briefs = await fetchSynthesisBriefs({ symbol, briefType, limit });
    return NextResponse.json({ success: true, briefs });
  } catch (err) {
    console.error("[intel/briefs]", err);
    return NextResponse.json({ success: false, briefs: [] }, { status: 500 });
  }
}
