import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { executeAnalyzeChart } from "@/lib/chart/analyze-chart-tool";
import { buildChartSpec } from "@/lib/chart/tradingview-spec";
import { fetchFundamentalSnapshot, formatFundamentalsForPrompt } from "@/lib/markets/fundamentals";
import { fetchSentimentSnapshot, formatSentimentForPrompt } from "@/lib/markets/sentiment";
import { assetClassForSymbol } from "@/lib/market/watchlist";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { symbol?: string; interval?: string; indicators?: string[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const symbol = body.symbol?.trim();
  if (!symbol) {
    return Response.json({ error: "symbol is required" }, { status: 400 });
  }

  const interval = body.interval ?? "D";
  const indicators = body.indicators ?? ["RSI", "MACD", "Volume"];
  const assetClass = assetClassForSymbol(symbol);

  try {
    const [fundamentals, sentiment] = await Promise.all([
      fetchFundamentalSnapshot(symbol, assetClass),
      fetchSentimentSnapshot(symbol),
    ]);

    const contextBlock = [
      "## Fundamentals",
      formatFundamentalsForPrompt(fundamentals),
      "## Sentiment / Macro",
      formatSentimentForPrompt(sentiment),
    ].join("\n\n");

    const result = await executeAnalyzeChart({
      symbol,
      interval,
      indicators,
      range: "3M",
      question: `Multi-factor analysis for average traders seeking actionable opportunities.\n\n${contextBlock}\n\nProvide concrete entry zones, stop loss, take profit ideas, and what to watch in real time.`,
      userId: user.id,
    });

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const send = (obj: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };

        const analysis = result.analysis;
        const chunks = (analysis.reasoning ?? analysis.summary ?? "").match(/.{1,80}(\s|$)/g) ?? [
          analysis.summary,
        ];

        for (const chunk of chunks) {
          if (chunk?.trim()) {
            send({ type: "reasoning", text: chunk });
          }
        }

        send({
          type: "analysis",
          analysis,
          snapshot_url: result.snapshot_url,
        });
        if (result.genui) {
          send({ type: "genui", payload: result.genui });
        }
        send({
          type: "done",
          analysis,
          snapshot_url: result.snapshot_url,
        });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return Response.json({ spec: null });
  }
  const spec = buildChartSpec({
    symbol,
    interval: req.nextUrl.searchParams.get("interval") ?? "D",
    indicators: req.nextUrl.searchParams.get("indicators")?.split(",") ?? ["RSI", "MACD"],
  });
  return Response.json({ spec });
}
