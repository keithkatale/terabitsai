import { Queue, Worker } from "bullmq";
import { runHotScan, runFullScan, getIntervals } from "./scan-jobs.js";

type SchedulerMode = "interval" | "bullmq";

export async function startScheduler(mode: SchedulerMode): Promise<void> {
  const { hot, full } = getIntervals();

  if (mode === "bullmq") {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error("REDIS_URL required for BullMQ mode");

    const connection = { url: redisUrl, maxRetriesPerRequest: null as null };
    const hotQueue = new Queue("intel-hot", { connection });
    const fullQueue = new Queue("intel-full", { connection });

    await hotQueue.add("hot-scan", {}, { repeat: { every: hot }, jobId: "intel-hot-repeat" });
    await fullQueue.add("full-scan", {}, { repeat: { every: full }, jobId: "intel-full-repeat" });

    new Worker(
      "intel-hot",
      async () => {
        await runHotScan();
      },
      { connection }
    );

    new Worker(
      "intel-full",
      async () => {
        await runFullScan();
      },
      { connection }
    );

    console.log(`[intel-worker] BullMQ scheduler active (hot ${hot / 1000}s, full ${full / 1000}s)`);
    return;
  }

  await runHotScan();
  setInterval(() => {
    runHotScan().catch((err) => console.error("[intel-worker] Hot scan failed:", err));
  }, hot);

  setInterval(() => {
    runFullScan().catch((err) => console.error("[intel-worker] Full scan failed:", err));
  }, full);

  console.log(`[intel-worker] Interval scheduler active (hot ${hot / 1000}s, full ${full / 1000}s)`);
}
