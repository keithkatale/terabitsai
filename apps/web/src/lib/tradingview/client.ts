/**
 * Server-side TradingView HTTP client.
 * Ported from finance-skills opencli-plugins/tradingview.
 *
 * Auth: set TRADINGVIEW_COOKIE env (semicolon-separated cookie string from a logged-in session),
 * or run TradingView desktop with CDP locally and harvest cookies via opencli.
 * Many scanner endpoints work without auth; news/search may require cookies.
 */

import { getTradingViewCookieFromCdp } from "./cdp-cookies";

const TV_HEADERS: Record<string, string> = {
  Origin: "https://www.tradingview.com",
  Referer: "https://www.tradingview.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) " +
    "TradingView/3.1.0 Chrome/140.0.7339.133 Electron/38.2.2 Safari/537.36 TVDesktop/3.1.0",
};

export async function tradingViewFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let cookie = process.env.TRADINGVIEW_COOKIE?.trim();
  if (!cookie) {
    cookie = (await getTradingViewCookieFromCdp()) ?? undefined;
  }

  const headers: Record<string, string> = {
    ...TV_HEADERS,
    ...(init.headers as Record<string, string> | undefined),
  };
  if (cookie) {
    headers.Cookie = cookie;
  }

  return fetch(url, { ...init, headers });
}

export function tradingViewAuthHint(): string {
  return (
    "TradingView API returned an auth error. Set TRADINGVIEW_COOKIE in server env, " +
    "or run TradingView desktop with CDP (OPENCLI_CDP_ENDPOINT=http://127.0.0.1:9222), " +
    "or use Capital.com tools as fallback."
  );
}
