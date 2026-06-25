/**
 * Optional CDP cookie harvest from local TradingView desktop app.
 * Set OPENCLI_CDP_ENDPOINT=http://127.0.0.1:9222 (run: opencli tradingview launch)
 */

const DEFAULT_ENDPOINT = "http://127.0.0.1:9222";
const HARVEST_TIMEOUT_MS = 5000;

let cachedCookieHeader: string | null = null;

export function getCdpEndpoint(): string {
  return (
    process.env.OPENCLI_CDP_ENDPOINT ??
    process.env.TRADINGVIEW_CDP_ENDPOINT ??
    DEFAULT_ENDPOINT
  ).replace(/\/$/, "");
}

async function fetchBrowserWsUrl(endpoint: string): Promise<string> {
  const res = await fetch(`${endpoint}/json/version`);
  if (!res.ok) throw new Error(`CDP HTTP ${res.status}`);
  const meta = (await res.json()) as { webSocketDebuggerUrl?: string };
  if (!meta.webSocketDebuggerUrl) throw new Error("CDP missing webSocketDebuggerUrl");
  return meta.webSocketDebuggerUrl;
}

function harvestCookies(browserWsUrl: string): Promise<Array<{ name: string; value: string; domain?: string }>> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(browserWsUrl);
    } catch (err) {
      reject(err);
      return;
    }

    const timeout = setTimeout(() => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      reject(new Error(`CDP Storage.getCookies timeout (${HARVEST_TIMEOUT_MS}ms)`));
    }, HARVEST_TIMEOUT_MS);

    const reqId = 1;

    ws.addEventListener("message", (ev) => {
      let msg: { id?: number; error?: { message: string }; result?: { cookies?: Array<{ name: string; value: string; domain?: string }> } };
      try {
        msg = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data));
      } catch {
        return;
      }
      if (msg.id !== reqId) return;
      clearTimeout(timeout);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      if (msg.error) {
        reject(new Error(`CDP error: ${msg.error.message}`));
        return;
      }
      resolve(msg.result?.cookies ?? []);
    });

    ws.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("CDP WebSocket error"));
    });

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ id: reqId, method: "Storage.getCookies", params: {} }));
    });
  });
}

export async function getTradingViewCookieFromCdp(): Promise<string | null> {
  if (cachedCookieHeader) return cachedCookieHeader;

  try {
    const endpoint = getCdpEndpoint();
    const wsUrl = await fetchBrowserWsUrl(endpoint);
    const cookies = await harvestCookies(wsUrl);
    const tvCookies = cookies.filter(
      (c) =>
        c.domain &&
        (c.domain === "tradingview.com" ||
          c.domain === ".tradingview.com" ||
          c.domain.endsWith(".tradingview.com")),
    );
    if (tvCookies.length === 0) return null;
    cachedCookieHeader = tvCookies.map((c) => `${c.name}=${c.value}`).join("; ");
    return cachedCookieHeader;
  } catch {
    return null;
  }
}
