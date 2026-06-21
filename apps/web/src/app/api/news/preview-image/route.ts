import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (compatible; TerabitsNewsBot/1.0; +https://terabits.ai) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";

const cache = new Map<string, { imageUrl: string | null; expires: number }>();
const CACHE_MS = 6 * 60 * 60 * 1000;

function extractOgImage(html: string): string | null {
  const patterns = [
    /property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["']/i,
    /name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*name=["']twitter:image(?::src)?["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].replace(/&amp;/g, "&");
  }
  return null;
}

async function resolvePreviewImage(pageUrl: string): Promise<string | null> {
  const cached = cache.get(pageUrl);
  if (cached && cached.expires > Date.now()) return cached.imageUrl;

  try {
    const res = await fetch(pageUrl, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      cache.set(pageUrl, { imageUrl: null, expires: Date.now() + CACHE_MS });
      return null;
    }
    const html = (await res.text()).slice(0, 120_000);
    const imageUrl = extractOgImage(html);
    cache.set(pageUrl, { imageUrl, expires: Date.now() + CACHE_MS });
    return imageUrl;
  } catch {
    cache.set(pageUrl, { imageUrl: null, expires: Date.now() + 5 * 60 * 1000 });
    return null;
  }
}

export async function GET(request: NextRequest) {
  const pageUrl = request.nextUrl.searchParams.get("url");
  if (!pageUrl) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(pageUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "invalid url" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  const proxy = request.nextUrl.searchParams.get("proxy") === "1";

  const imageUrl = await resolvePreviewImage(parsed.toString());
  if (!imageUrl) {
    return proxy
      ? new NextResponse(null, { status: 404 })
      : NextResponse.json({ imageUrl: null });
  }

  if (!proxy) {
    return NextResponse.json(
      { imageUrl },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  }

  try {
    const imgRes = await fetch(imageUrl, {
      headers: { "User-Agent": UA, Referer: parsed.origin },
      signal: AbortSignal.timeout(8000),
    });
    if (!imgRes.ok) return new NextResponse(null, { status: 404 });
    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const buffer = await imgRes.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
