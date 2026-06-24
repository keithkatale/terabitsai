import {
  type ChartSpec,
  specHash,
  specToQueryParams,
} from "./tradingview-spec";
import { getCachedSnapshot, setCachedSnapshot } from "./snapshot-cache";

export type RenderSource = "cache" | "service";

function requireServiceUrl(): string {
  const url =
    process.env.CHART_RENDER_SERVICE_URL?.trim() ||
    process.env.CHART_RENDERER_URL?.trim();
  if (!url) {
    throw new Error(
      "CHART_RENDER_SERVICE_URL is not configured — deploy chart-renderer to Cloud Run and set the URL",
    );
  }
  return url.replace(/\/$/, "");
}

function requireServiceApiKey(): string {
  const key =
    process.env.CHART_RENDER_API_KEY?.trim() ||
    process.env.CHART_RENDERER_API_KEY?.trim();
  if (!key) {
    throw new Error("CHART_RENDER_API_KEY is not configured");
  }
  return key;
}

/** Call our self-hosted chart-renderer service on Cloud Run */
async function renderViaChartService(spec: ChartSpec): Promise<Buffer> {
  const base = requireServiceUrl();
  const apiKey = requireServiceApiKey();

  const params = specToQueryParams(spec);
  const url = `${base}/render?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      Accept: "image/png",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Chart render service returned ${res.status}: ${body.slice(0, 300)}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("image")) {
    const body = await res.text().catch(() => "");
    throw new Error(`Chart render service did not return PNG: ${body.slice(0, 200)}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

/**
 * Render a TradingView chart screenshot via the Cloud Run chart-renderer service.
 */
export async function renderTradingViewChart(spec: ChartSpec): Promise<{
  buffer: Buffer;
  hash: string;
  source: RenderSource;
}> {
  const hash = specHash(spec);
  const cached = getCachedSnapshot(hash);
  if (cached) {
    return { buffer: cached, hash, source: "cache" };
  }

  const buffer = await renderViaChartService(spec);
  setCachedSnapshot(hash, buffer);
  return { buffer, hash, source: "service" };
}
