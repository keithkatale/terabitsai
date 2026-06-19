import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@quant/db";
import { fetchCalendarEvents } from "@/lib/intel/synthesis";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();
  const days = Number(searchParams.get("days") ?? 7);

  try {
    const events = await fetchCalendarEvents(days);
    const filtered = symbol ? events.filter((e) => e.symbol === symbol || e.symbols.includes(symbol)) : events;

    const contradictions = await prisma.contradictionAlert.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      orderBy: { createdAt: "desc" },
      take: 20
    });

    return NextResponse.json({
      success: true,
      events: filtered.map((e) => ({
        id: e.id,
        symbol: e.symbol,
        title: e.title,
        body: e.body,
        eventType: e.eventType,
        publishedAt: e.publishedAt?.toISOString()
      })),
      contradictions
    });
  } catch (err) {
    console.error("[intel/calendar]", err);
    return NextResponse.json({ success: false, events: [], contradictions: [] }, { status: 500 });
  }
}
