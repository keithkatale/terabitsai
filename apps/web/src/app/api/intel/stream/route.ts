import { fetchIntelFeed } from "@/lib/intel/feed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const encoder = new TextEncoder();
  let lastCount = 0;
  let interval: ReturnType<typeof setInterval> | null = null;
  let keepAlive: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const poll = async () => {
        try {
          const items = await fetchIntelFeed({
            limit: 5,
            since: new Date(Date.now() - 5 * 60 * 1000)
          });
          if (items.length !== lastCount) {
            lastCount = items.length;
            send({ type: "update", count: items.length });
          } else {
            send({ type: "heartbeat" });
          }
        } catch {
          send({ type: "error" });
        }
      };

      await poll();
      interval = setInterval(poll, 15_000);
      keepAlive = setInterval(() => send({ type: "ping" }), 30_000);
    },
    cancel() {
      if (interval) clearInterval(interval);
      if (keepAlive) clearInterval(keepAlive);
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
