import { NextResponse } from "next/server";
import { runProactiveChatTurn } from "@/lib/chat/proactive-turn";

function authorizeCron(request: Request): boolean {
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  if (process.env.NODE_ENV === "development") return true;
  return false;
}

export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const userId = body.userId as string;
    const mode = body.mode === "live" ? "live" : "demo";
    const conversationId = body.conversationId as string;
    const directive = body.directive as string;
    const cycleId = (body.cycleId as string) ?? "manual";
    const narration = (body.narration as string) ?? "";

    if (!userId || !conversationId || !directive) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const result = await runProactiveChatTurn({
      userId,
      mode,
      conversationId,
      directive,
      cycleId,
      narration,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Proactive turn failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
