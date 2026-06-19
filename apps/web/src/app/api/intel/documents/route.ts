import { NextRequest, NextResponse } from "next/server";
import { fetchIntelDocuments } from "@/lib/intel/synthesis";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();
  const diet = searchParams.get("diet") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? 30);

  try {
    const documents = await fetchIntelDocuments({ symbol, diet, limit });
    return NextResponse.json({ success: true, documents });
  } catch (err) {
    console.error("[intel/documents]", err);
    return NextResponse.json({ success: false, documents: [] }, { status: 500 });
  }
}
