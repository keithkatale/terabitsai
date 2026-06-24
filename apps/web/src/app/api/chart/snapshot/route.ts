import { NextRequest, NextResponse } from "next/server";
import { getCachedSnapshot } from "@/lib/chart/snapshot-cache";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const hash = request.nextUrl.searchParams.get("hash");
  if (!hash || !/^[a-f0-9]{16}$/.test(hash)) {
    return NextResponse.json({ error: "Invalid hash" }, { status: 400 });
  }

  const buffer = getCachedSnapshot(hash);
  if (!buffer) {
    return NextResponse.json({ error: "Snapshot not found or expired" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
