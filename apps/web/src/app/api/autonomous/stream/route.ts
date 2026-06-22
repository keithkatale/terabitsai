import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const goalId = request.nextUrl.searchParams.get("goalId");
  const encoder = new TextEncoder();
  let lastSeen = new Date().toISOString();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: "connected", at: lastSeen });

      const interval = setInterval(async () => {
        try {
          let query = supabase
            .from("agent_activity")
            .select("*")
            .eq("user_id", user.id)
            .gt("created_at", lastSeen)
            .order("created_at", { ascending: true })
            .limit(20);

          if (goalId) query = query.eq("goal_id", goalId);

          const { data } = await query;
          if (data && data.length > 0) {
            lastSeen = data[data.length - 1].created_at;
            send({ type: "update", items: data });
          } else {
            send({ type: "heartbeat", at: new Date().toISOString() });
          }
        } catch (err) {
          send({
            type: "error",
            message: err instanceof Error ? err.message : "Stream error",
          });
        }
      }, 5000);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
