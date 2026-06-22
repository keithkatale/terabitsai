/** Client-side trigger for Wealth Monitor when the countdown reaches zero. */

type TriggerResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
};

let inFlightTrigger: Promise<TriggerResult> | null = null;

export async function triggerWealthMonitorCycle(goalId?: string): Promise<TriggerResult> {
  if (inFlightTrigger) return inFlightTrigger;

  inFlightTrigger = (async () => {
    try {
      const res = await fetch("/api/autonomous/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(goalId ? { goalId } : {}),
      });
      const json = (await res.json().catch(() => ({}))) as {
        skipped?: boolean;
        error?: string;
        result?: { skipped?: boolean; reason?: string };
      };

      if (!res.ok) {
        if (res.status === 409 || json.skipped || json.result?.skipped) {
          return { ok: true, skipped: true };
        }
        return { ok: false, error: json.error ?? "Trigger failed" };
      }

      return { ok: true, skipped: json.result?.skipped };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Trigger failed",
      };
    } finally {
      inFlightTrigger = null;
    }
  })();

  return inFlightTrigger;
}
