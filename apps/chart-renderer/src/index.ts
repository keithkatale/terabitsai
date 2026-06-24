import "dotenv/config";
import { createHash } from "crypto";
import http from "node:http";
import { URL } from "node:url";
import { buildChartFrameHtml } from "./frame-html.js";
import { closeBrowser, renderChartPng } from "./render.js";

const PORT = Number(process.env.PORT ?? 8080);
const API_KEY = process.env.CHART_RENDER_API_KEY?.trim();

type CacheEntry = { buffer: Buffer; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000;

function authorize(req: http.IncomingMessage): boolean {
  if (!API_KEY) return true;
  const auth = req.headers.authorization ?? "";
  return auth === `Bearer ${API_KEY}` || auth === API_KEY;
}

function cacheKey(params: URLSearchParams): string {
  const payload = params.toString();
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

function parseRenderParams(searchParams: URLSearchParams) {
  const symbol = searchParams.get("symbol")?.trim();
  if (!symbol) throw new Error("symbol is required");

  const studiesRaw = searchParams.get("studies") ?? "RSI@tv-basicstudies,MACD@tv-basicstudies";
  const studies = studiesRaw.split(",").map((s) => s.trim()).filter(Boolean);

  return {
    symbol,
    interval: searchParams.get("interval")?.trim() || "D",
    studies,
    theme: searchParams.get("theme")?.trim() || "dark",
    style: searchParams.get("style")?.trim() || "candles",
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);

  if (url.pathname === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "chart-renderer" }));
    return;
  }

  if (url.pathname === "/frame") {
    try {
      const params = parseRenderParams(url.searchParams);
      const html = buildChartFrameHtml(params);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
    return;
  }

  if (url.pathname === "/render" && req.method === "GET") {
    if (!authorize(req)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    try {
      const params = parseRenderParams(url.searchParams);
      const key = cacheKey(url.searchParams);
      const hit = cache.get(key);
      if (hit && hit.expiresAt > Date.now()) {
        res.writeHead(200, {
          "Content-Type": "image/png",
          "Cache-Control": "private, max-age=3600",
          "X-Render-Source": "cache",
        });
        res.end(hit.buffer);
        return;
      }

      const frameUrl = `http://127.0.0.1:${PORT}/frame?${url.searchParams.toString()}`;
      const started = Date.now();
      const buffer = await renderChartPng(frameUrl);

      cache.set(key, { buffer, expiresAt: Date.now() + CACHE_TTL_MS });

      console.log(
        `[chart-renderer] rendered ${params.symbol} ${params.interval} (${buffer.length} bytes, ${Date.now() - started}ms)`,
      );

      res.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
        "X-Render-Source": "headless",
      });
      res.end(buffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[chart-renderer] render failed:", message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: message }));
    }
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

process.on("SIGTERM", () => {
  closeBrowser().finally(() => process.exit(0));
});

server.listen(PORT, () => {
  console.log(`[chart-renderer] listening on :${PORT}`);
});
