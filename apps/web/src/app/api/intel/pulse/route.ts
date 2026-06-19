import { NextResponse } from "next/server";
import { fetchLatestPulse } from "@/lib/intel/feed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const pulse = await fetchLatestPulse();
    if (!pulse) {
      return NextResponse.json({
        themes: [
          { label: "Risk Appetite", value: "Neutral" },
          { label: "Signal Vol", value: "Normal" }
        ]
      });
    }
    return NextResponse.json(pulse);
  } catch (err) {
    console.error("[intel/pulse]", err);
    return NextResponse.json({ themes: [] }, { status: 500 });
  }
}
